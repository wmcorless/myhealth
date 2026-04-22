import React from 'react';
import Svg, { Circle, Path, Text } from 'react-native-svg';

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
        d="M60 84 C42 70, 30 58, 30 44 C30 34, 38 26, 48 26 C54 26, 58 29, 60 33 C62 29, 66 26, 72 26 C82 26, 90 34, 90 44 C90 58, 78 70, 60 84 Z"
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
