import React from 'react';
import type { ButtonProps } from '@calipartner/ui';

/** Render element slots as children, as the real button does (not JSON host properties). */
export function ButtonStub({ icon, trailingIcon, label, ...props }: ButtonProps) {
  return React.createElement(
    'Button',
    { ...props, label },
    icon,
    React.createElement('Text', {}, label),
    trailingIcon,
  );
}
