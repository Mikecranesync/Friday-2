import React, { useEffect, useRef } from 'react';

interface WaveformProps {
  analyser: AnalyserNode | null;
  isActive: boolean;
  color?: string;
}

const Waveform: React.FC<WaveformProps> = ({ analyser, isActive, color = '#38bdf8' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const dataArray = new Uint8Array(analyser ? analyser.frequencyBinCount : 0);

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      if (!isActive) {
        // Draw a flat line or gentle pulse when inactive
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.stroke();
        return;
      }

      if (analyser) {
        analyser.getByteTimeDomainData(dataArray);
      }

      ctx.lineWidth = 3;
      ctx.strokeStyle = color;
      ctx.beginPath();

      const sliceWidth = width * 1.0 / dataArray.length;
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * height / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      // Add a glow effect
      ctx.shadowBlur = 15;
      ctx.shadowColor = color;
      
      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [analyser, isActive, color]);

  return (
    <canvas 
      ref={canvasRef} 
      width={600} 
      height={200} 
      className="w-full h-full object-cover"
    />
  );
};

export default Waveform;
