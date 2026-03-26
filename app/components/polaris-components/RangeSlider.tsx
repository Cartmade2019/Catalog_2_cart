import React from "react";
import { RangeSlider } from "@shopify/polaris";

interface RangeSliderComponentProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
}

const RangeSliderComponent: React.FC<RangeSliderComponentProps> = ({
  value,
  onChange,
  min = 0,
  max = 15,
}) => {
  const handleChange = (value: number, id?: string) => {
    onChange(value);
  };

  return ( 
    <RangeSlider
      label="Hotspot size"
      value={value}
      min={min}
      max={max}
      onChange={handleChange}
      output
    />
  );
};

export default RangeSliderComponent;
