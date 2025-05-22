import { useEffect, useRef } from 'react';
import QRCodeLib from 'qrcode';

interface QRCodeProps {
  value: string;
  size?: number;
  level?: 'L' | 'M' | 'Q' | 'H';
  bgColor?: string;
  fgColor?: string;
  className?: string;
}

const QRCode: React.FC<QRCodeProps> = ({
  value,
  size = 128,
  level = 'M',
  bgColor = '#ffffff',
  fgColor = '#000000',
  className,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;

    const generateQR = async () => {
      try {
        await QRCodeLib.toCanvas(canvasRef.current, value, {
          width: size,
          margin: 1,
          errorCorrectionLevel: level,
          color: {
            dark: fgColor,
            light: bgColor,
          },
        });
      } catch (err) {
        console.error('Error generating QR code:', err);
      }
    };

    generateQR();
  }, [value, size, level, bgColor, fgColor]);

  if (!value) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      className={className}
      width={size}
      height={size}
    />
  );
};

export default QRCode;
