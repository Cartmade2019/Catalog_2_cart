import { useState } from "react";
import {
  TextField,
  Card,
  BlockStack,
  Layout,
  RangeSlider,
  Page,
  Button,
} from "@shopify/polaris";
import { useFetcher } from "@remix-run/react";
import HotspotButton from "./polaris-components/HotspotButton";
import InputColorPicker from "./InputColorPicker";
import LivePreview from "./LivePreview";

const ButtonDesign = ({ buttonSettings: { jsonValue } }: any) => {
  const fetcher = useFetcher();
  const [buttonText, setButtonText] = useState(
    jsonValue?.buttonText || "Add to cart",
  );
  const [fontSize, setFontSize] = useState<number>(jsonValue?.fontSize || 15);
  const [paddingY, setPaddingY] = useState<number>(jsonValue?.paddingY || 0);
  const [paddingX, setPaddingX] = useState<number>(jsonValue?.paddingX || 0);

  const [shadow, setShadow] = useState<number>(jsonValue?.shadow || 0);
  const [borderRadius, setBorderRadius] = useState<number>(
    jsonValue?.borderRadius || 4,
  );
  const [borderWidth, setBorderWidth] = useState<number>(
    jsonValue?.borderWidth || 0,
  );
  const [hotspotColor, setHotspotColor] = useState(
    jsonValue?.hotspotColor || "#a34423",
  );

  const [borderColor, setBorderColor] = useState(
    jsonValue?.borderColor || "#ffffff",
  );
  const [shadowColor, setShadowColor] = useState(
    jsonValue?.shadowColor || "#345acd",
  );
  const [backgroundColor, setBackgroundColor] = useState(
    jsonValue?.backgroundColor || "#000000",
  );
   const [textColor, setTextColor] = useState(jsonValue?.textColor || "#ffffff");

const [buttonTextError, setButtonTextError] = useState("");
  const handleButtonTextChange = (value: string) =>{ setButtonText(value);
     if (value.trim()) setButtonTextError("");
  };
  const handleFontSizeChange = (value: number) => setFontSize(value);
  const handlePaddingYChange = (value: number) => setPaddingY(value);
  const handlePaddingXChange = (value: number) => setPaddingX(value);
  const handleShadowChange = (value: number) => setShadow(value);
  const handleBorderRadiusChange = (value: number) => setBorderRadius(value);
  const handleBorderWidthChange = (value: number) => setBorderWidth(value);

  const handleSubmit = () => {

    if (!buttonText.trim()) {
     setButtonTextError("Button text is required");
     return;
   }
   if(buttonText.length > 16){
     setButtonTextError("Button text must be less than 16 characters");
     return;
   }

    const formData = new FormData();
    formData.append("source", "ButtonDesign");
    formData.append("buttonText", buttonText);
    formData.append("fontSize", fontSize.toString());
    formData.append("borderRadius", borderRadius.toString());
    formData.append("borderWidth", borderWidth.toString());

    formData.append("borderColor", borderColor);
    formData.append("backgroundColor", backgroundColor);
    formData.append("textColor", textColor);
    formData.append("paddingY", paddingY.toString());
    formData.append("paddingX", paddingX.toString());
    formData.append("shadow", shadow.toString());
    formData.append("shadowColor", shadowColor);
    formData.append("hotspotColor", hotspotColor);

    fetcher.submit(formData, { method: "post" });
  };

  if (fetcher.state === "loading") {
    shopify.toast.show("Button setting saved successfully");
  }

  return (
    <div className="space-y-2 p-8 bg-gray-50 rounded-lg shadow-lg">
      <p className="flex font-bold  text-lg items-center justify-between">
        Hotspot settings
        <Button
          variant="primary"
          loading={fetcher.state === "submitting"}
          onClick={handleSubmit}
        >
          Save
        </Button>
      </p>
      <h2 className="font-bold pt-3 ">Customize the Hotspot button</h2>

      <div className="w-full  flex">
        <div className="w-1/2">
          <div>
            <Card>
              <p className="font-light min-h-20">
                <span className="font-semibold">
                  {" "}
                  This is the button that your customers will click to view the
                  information of the product.
                </span>{" "}
                Customize here the design of your hotspot button to fit it with
                your brand style.
              </p>
            </Card>
          </div>
        </div>
        <div className="w-1/2 ml-2 h-full">
          <Card>
            <div className="min-h-20">
              <BlockStack align="center">
                <LivePreview />
                <div className="flex items-center justify-between">
                  <InputColorPicker
                    title="Hotspot Color"
                    flag="hotspot"
                    setState={setHotspotColor}
                    value={hotspotColor}
                  />
                  <div
                    className="image-hotspots--pin   text-white text-sm h-9 w-9 rounded-full shadow-lg cursor-pointer animate-pulse"
                    style={{
                      backgroundColor: hotspotColor,
                      transform: "unset !important",
                    }}
                  >
                    <HotspotButton />
                  </div>
                </div>
              </BlockStack>
            </div>
          </Card>
        </div>
      </div>

      {/* Button Preview */}
      <div className=" pt-6">
        <h2 className="text-lg font-bold mb-2">Button Settings</h2>

        <h2 className="font-bold py-2 ">Customize the Add to cart button</h2>
        <div className="mb-4">
          <Card roundedAbove="lg">
            <p className="font-light">
              <span className="font-semibold">
                {" "}
                This is the button that your customers will click to add the
                product on the cart page.
              </span>{" "}
              Customize here the text and design of your button to fit it with
              your brand style. The button will use the same font of your store
              when it will be generated on your store.
            </p>
          </Card>
        </div>
        <Card>
          <div className="button-settings-wrapper flex flex-wrap gap-4">
            <div className="flex border-0  sm:border-r-2 sm:pr-4 flex-col gap-3 button-settings-item">
              <div className="max-w-[264px]">
                <TextField
                  size="slim"
                  autoComplete="true"
                  label="Button Title"
                  value={buttonText}
                  onChange={handleButtonTextChange}
                  error={buttonTextError || undefined}
                />
              </div>

              <InputColorPicker
                title="Background Color"
                setState={setBackgroundColor}
                value={backgroundColor}
              />

              <InputColorPicker
                title="Text Color"
                setState={setTextColor}
                value={textColor}
              />
              <InputColorPicker
                title="Shadow Color"
                setState={setShadowColor}
                value={shadowColor}
              />
              <InputColorPicker
                title="Border Color"
                setState={setBorderColor}
                value={borderColor}
              />

              <div className=" flex max-w-[256px] flex-col gap-5">
                <RangeSlider
                  label="Font size"
                  value={fontSize}
                  min={15}
                  max={30}
                  onChange={handleFontSizeChange}
                  output
                />
                <RangeSlider
                  label="Border radius"
                  value={borderRadius}
                  min={1}
                  max={15}
                  onChange={handleBorderRadiusChange}
                  output
                />
                <RangeSlider
                  label="Border width"
                  min={0}
                  max={15}
                  value={borderWidth}
                  onChange={handleBorderWidthChange}
                  output
                />
                <RangeSlider
                  label="Shadow"
                  min={0}
                  max={15}
                  value={shadow}
                  onChange={handleShadowChange}
                  output
                />
                <RangeSlider
                  label="Padding Y"
                  value={paddingY}
                  min={5}
                  max={25}
                  onChange={handlePaddingYChange}
                  output
                />
                <RangeSlider
                  label="Padding X"
                  value={paddingX}
                  min={5}
                  max={25}
                  onChange={handlePaddingXChange}
                  output
                />
              </div>
            </div>
            <div className="flex flex-col button-settings-item">
              <Layout.Section variant="oneHalf">
                <LivePreview />
                <Card>
                  <div>
                    <button
                      className="overflow-hidden Polaris-Button Polaris-Button--pressable Polaris-Button--variantPrimary Polaris-Button--sizeMedium Polaris-Button--textAlignCenter Polaris-Button--fullWidth Polaris-Button--iconWithText "
                      type="button"
                      style={{
                        backgroundColor: backgroundColor,
                        color: textColor,
                        fontWeight: 400,
                        borderWidth,
                        borderStyle: "solid",
                        borderColor: borderColor,
                        borderRadius,
                        fontSize,
                        boxShadow: `2px 2px ${shadow}px ${shadowColor}`,
                        padding: `${paddingY}px ${paddingX}px`,
                      }}
                    >
                      {buttonText}
                    </button>
                  </div>
                </Card>
              </Layout.Section>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ButtonDesign;
