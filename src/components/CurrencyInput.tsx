import { Input } from '@/components/ui/input';
import { useState, useEffect } from 'react';

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function CurrencyInput({ value, onChange, placeholder = 'R$ 0,00', className, disabled }: CurrencyInputProps) {
  const [display, setDisplay] = useState('');

  useEffect(() => {
    if (value === 0 && display === '') return;
    setDisplay(value ? value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');
  }, [value]);

  const handleChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) {
      setDisplay('');
      onChange(0);
      return;
    }
    const num = parseInt(digits, 10) / 100;
    setDisplay(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    onChange(num);
  };

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
      <Input
        value={display}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={(e) => e.target.select()}
        placeholder={placeholder}
        className={`pl-10 ${className || ''}`}
        disabled={disabled}
        inputMode="numeric"
      />
    </div>
  );
}
