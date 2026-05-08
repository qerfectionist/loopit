import { useRef, useState, useEffect, useCallback } from 'react';
import { ScanLine, X, Loader2 } from 'lucide-react';
import { lookupISBN, type BookInfo } from '@/lib/isbn';

interface ISBNScannerProps {
  onResult: (book: BookInfo) => void;
  onClose: () => void;
}

declare global {
  interface Window {
    BarcodeDetector: new (opts: { formats: string[] }) => {
      detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
    };
  }
}

export const ISBNScanner = ({ onResult, onClose }: ISBNScannerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const [status, setStatus] = useState<'scanning' | 'loading' | 'error'>('scanning');
  const [errorMsg, setErrorMsg] = useState('');

  // Defined before useEffect to avoid declaration-before-use issue
  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const handleClose = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    stopStream();
    onClose();
  }, [stopStream, onClose]);

  useEffect(() => {
    let stopped = false;
    let detector: InstanceType<Window['BarcodeDetector']> | null = null;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'isbn'] });

        const scan = async () => {
          if (stopped || !videoRef.current || !detector) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const found = codes.find((c) =>
              /^\d{9,13}$/.test(c.rawValue.replace(/-/g, ''))
            );
            if (found) {
              stopped = true;
              setStatus('loading');
              const book = await lookupISBN(found.rawValue.replace(/-/g, ''));
              if (book) {
                stopStream();
                onResult(book);
                return;
              } else {
                setStatus('error');
                setErrorMsg(`ISBN ${found.rawValue} not found in OpenLibrary`);
                stopped = false;
                setStatus('scanning');
              }
            }
          } catch {
            // detect() may throw on empty frames — safe to ignore
          }
          rafRef.current = requestAnimationFrame(scan);
        };

        rafRef.current = requestAnimationFrame(scan);
      } catch (err) {
        setStatus('error');
        setErrorMsg(err instanceof Error ? err.message : 'Camera access denied');
      }
    };

    start();

    return () => {
      stopped = true;
      cancelAnimationFrame(rafRef.current);
      stopStream();
    };
  }, [onResult, stopStream]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-10 pb-3">
        <p className="text-white text-[16px] font-semibold">Scan ISBN barcode</p>
        <button
          onClick={handleClose}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10"
        >
          <X size={20} className="text-white" />
        </button>
      </div>

      {/* Camera view */}
      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
        />

        {/* Scanning overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-72 h-36 relative">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white rounded-tl-sm" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white rounded-tr-sm" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white rounded-bl-sm" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white rounded-br-sm" />

            {status === 'scanning' && (
              <ScanLine
                size={280}
                className="absolute top-1/2 -translate-y-1/2 -left-1 text-green-400 animate-pulse"
              />
            )}
            {status === 'loading' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 size={32} className="text-white animate-spin" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="px-5 py-4 pb-10">
        {status === 'scanning' && (
          <p className="text-white/70 text-[14px] text-center">
            Point camera at the barcode on the back of the book
          </p>
        )}
        {status === 'loading' && (
          <p className="text-white/70 text-[14px] text-center">Looking up book data...</p>
        )}
        {status === 'error' && (
          <p className="text-red-400 text-[14px] text-center">{errorMsg}</p>
        )}
      </div>
    </div>
  );
};
