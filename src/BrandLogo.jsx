import React from 'react';
import './logo.css';

export default function BrandLogo({mark=false}){
  // Frame the artwork inside the supplied PNGs without changing the originals.
  return <svg
    className={mark?'brand-mark':'brand-logo'}
    viewBox={mark?'18 386 4132 3395':'199 130 467 332'}
    width={mark?46:126}
    height={mark?38:90}
    role={mark?undefined:'img'}
    aria-hidden={mark?true:undefined}
    aria-label={mark?undefined:'亞加通路媒體'}
    focusable="false"
  >
    <image
      href={mark?'/media/brand/mark-white.png':'/media/brand/logo-white.png'}
      width={mark?4168:882}
      height={mark?4167:589}
    />
  </svg>;
}
