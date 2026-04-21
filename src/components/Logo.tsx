import React from 'react';
import Svg, { Circle, Path, Text, TSpan } from 'react-native-svg';

interface Props {
  size?: number;
}

export default function Logo({ size = 48 }: Props) {
  // Scale factor relative to original 280x120 viewBox
  const scale = size / 120;
  const width = 280 * scale;

  return (
    <Svg width={width} height={size} viewBox="0 0 280 120">
      {/* Red circle */}
      <Circle cx="60" cy="60" r="55" fill="#E53935" />
      {/* White heart */}
      <Path
        d="M60 85 C28 62, 10 46, 10 30 C10 16, 22 6, 35 6 C44 6, 52 11, 60 20 C68 11, 76 6, 85 6 C98 6, 110 16, 110 30 C110 46, 92 62, 60 85 Z"
        fill="#FFFFFF"
      />
      {/* "my" in red */}
      <Text
        x="130"
        y="52"
        fontSize="36"
        fontWeight="700"
        fill="#E53935"
        letterSpacing="-0.5"
      >
        my
      </Text>
      {/* "health" in dark */}
      <Text
        x="130"
        y="88"
        fontSize="36"
        fontWeight="700"
        fill="#222222"
        letterSpacing="-0.5"
      >
        health
      </Text>
    </Svg>
  );
}
