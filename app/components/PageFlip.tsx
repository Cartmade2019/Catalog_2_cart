import { useState, MouseEvent, useCallback, useRef, useEffect } from "react";
import { DeleteIcon, XIcon } from "@shopify/polaris-icons";
import { motion } from "framer-motion";
import Draggable from "react-draggable";
import { useFetcher } from "@remix-run/react";
import { IMAGES, Marker } from "app/constants/types";
import {
  BlockStack,
  Button,
  ButtonGroup,
  Card,
  ColorPicker,
  Icon,
  InlineStack,
  Layout,
  LegacyCard,
  List,
  Page,
  Pagination,
  Text,
} from "@shopify/polaris";
import { useSelector } from "react-redux";
import HotspotButton from "./polaris-components/HotspotButton";
import HTMLFlipBook from "react-pageflip";

const PageFlip = ({
  images,
  metaFieldId,
  pdfName,
  shopName,
  hotspotColor,
}: IMAGES) => {
  const fetcher = useFetcher();

  const plan = useSelector((state: any) => state.plan.plan);
  const colorPalette = [
    "#FF5733",
    "#FF8D1A",
    "#FFC300",
    "#DAF7A6",
    "#33FF57",
    "#33C7FF",
    "#6A33FF",
  ];

  const [currentPage, setCurrentPage] = useState<number>(0);
  const [animate, setAnimate] = useState<boolean>(false);
  const [markers, setMarkers] = useState<Marker[]>(
    images
      .filter((image: any) => image?.points?.length > 0)
      .flatMap((image: any) =>
        image.points.filter((point: Marker | undefined) => point !== undefined),
      ),
  );

  const [selectedMarker, setSelectedMarker] = useState<Marker | null>(null);

  const handleNextPage = () => {
    if (currentPage < images.length - 2) {
      setAnimate(true);
      setCurrentPage((prevPage) => prevPage + 2);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setAnimate(true);
      setCurrentPage((prevPage) => prevPage - 2);
    }
  };

  const [settings, setSettings] = useState({
    heading: "",
    description: "",
    horizonalValue: 10,
    verticalValue: 10,
    mobileHorizontalRange: 0,
    mobileVerticalRange: 0,
  });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const leftImageRef = useRef<HTMLDivElement | null>(null);
  const rightImageRef = useRef<HTMLDivElement | null>(null);

  const handleImageMarker = async (
    event: MouseEvent<HTMLImageElement>,
    ref: any,
    imageIndex: number,
  ) => {
    if (!ref.current) return;

    let maxMarkers = 0;
    if (plan === "Free") {
      maxMarkers = 3;
    } else if (plan === "Basic") {
      maxMarkers = 3;
    } else if (plan === "Advanced") {
      maxMarkers = Infinity;
    }

    const currentMarkersForPage = markers.filter(
      (marker) => marker.imageIndex === imageIndex,
    );
    const totalMarkers = markers.length;

    if (plan === "Free" && totalMarkers >= maxMarkers) {
      shopify.toast.show(
        "You have reached the maximum marker limit for your plan.",
      );
      return;
    }

    if (plan === "Basic" && currentMarkersForPage.length >= maxMarkers) {
      shopify.toast.show("You can only add 3 markers per page for your plan.");
      return;
    }
    const rect = ref.current.getBoundingClientRect();

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const imageWidth = rect.width;
    const imageHeight = rect.height;
    const xPercentage = (x / imageWidth) * 100;
    const yPercentage = (y / imageHeight) * 100;

    const selected: any = await shopify.resourcePicker({
      type: "product",
      multiple: 1,
      filter: { variants: false, archived: false, draft: false },
    });

    if (selected && selected.length > 0) {
      setMarkers((prevMarkers) => [
        ...prevMarkers,
        {
          pointId: Math.floor(Math.random() * 10000) + 1,
          x: x,
          y: y,
          imageIndex,
          comparedPrice: selected[0].variants[0].compareAtPrice,
          description: selected[0].descriptionHtml,
          price: selected[0].variants[0].price,
          handle: selected[0].handle,
          product: selected[0].title,
          productId: selected[0].id,
          productImage: selected[0]?.images[0]?.originalSrc,
          color: colorPalette[prevMarkers.length % colorPalette.length],
          xPercentage,
          yPercentage,
        },
      ]);
    }
  };

  const handleMarkerClick = (marker: Marker) => {
    setSelectedMarker(marker);
  };

  const handleRemoveMarker = () => {
    if (selectedMarker) {
      setMarkers((prevMarkers) =>
        prevMarkers.filter(
          (marker) => marker.pointId !== selectedMarker.pointId,
        ),
      );
      setSelectedMarker(null);
    }
  };

  const handleDragStop = useCallback(
    (e: MouseEvent, ref: any, markerIndex: number) => {
      if (!ref.current) return;
      const containerRect = ref.current.getBoundingClientRect();
      const x = e.clientX - containerRect.left;
      const y = e.clientY - containerRect.top;

      const containerWidth = containerRect.width;
      const containerHeight = containerRect.height;

      const xPercentage = (x / containerWidth) * 100;
      const yPercentage = (y / containerHeight) * 100;

      setMarkers((prevMarkers) => {
        const newMarkers = [...prevMarkers];
        const marker = newMarkers[markerIndex];
        if (marker) {
          marker.xPercentage = xPercentage;
          marker.yPercentage = yPercentage;
        }
        return newMarkers;
      });
    },
    [markers],
  );

  const handleSave = async () => {
    images.forEach((image) => {
      const imageMarkers = markers.filter(
        ({ imageIndex }) => imageIndex === image.id - 1,
      );
      image.points = [...imageMarkers];
    });

    const formData = new FormData();
    formData.append("images", JSON.stringify(images));
    formData.append("metaFieldId", metaFieldId);
    formData.append("pdfName", pdfName);
    fetcher.submit(formData, { method: "post" });
  };

  if (fetcher.state === "loading") {
    shopify.toast.show("Product saved");
  }

  const [color, setColor] = useState({
    hue: 120,
    brightness: 1,
    saturation: 1,
  });
  return (
    <div className="w-[80%]">
      <Page
        backAction={{ content: "Settings", url: "/app/pdf-convert" }}
        primaryAction={{
          content: "Save",
          onAction: handleSave,
          loading: fetcher.state === "submitting",
        }}
        fullWidth
      >
        <Layout>
          <Card background="bg-surface-secondary">
            <div
              // h-[80vh] w-full
              className="relative p-8  w-full mx-auto"
              id="image-container"
            >
              <motion.div
                ref={containerRef}
                className=" flex w-full  bg-white rounded-lg shadow-lg"
                initial={{ rotateY: 0, zIndex: 0 }}
                animate={{
                  rotateY: animate ? (currentPage % 2 === 0 ? 0 : -180) : 0,
                  zIndex: currentPage % 2 === 0 ? 0 : 1,
                }}
                transition={{ duration: 0.6 }}
                style={{ transformOrigin: "right center" }}
                onAnimationComplete={() => setAnimate(false)}
              >
                <div ref={leftImageRef} className="relative">
                  <img
                    src={images[currentPage].url}
                    alt={`Page ${currentPage + 1}`}
                    className="w-full cursor-crosshair h-full object-contain rounded-tl-lg  rounded-bl-lg"
                    onClick={(event) =>
                      handleImageMarker(event, leftImageRef, currentPage)
                    }
                  />

                  {markers.map(
                    (marker, index) =>
                      marker.imageIndex === currentPage && (
                        <Draggable
                          key={marker.pointId}
                          onStop={(e: any) =>
                            handleDragStop(e, leftImageRef, index)
                          }
                          onDrag={(e: any) =>
                            handleDragStop(e, leftImageRef, index)
                          }
                        >
                          <div
                            className="image-hotspots--pin z-20 absolute flex justify-center items-center text-white text-sm h-9 w-9 rounded-full shadow-lg cursor-pointer animate-pulse"
                            style={{
                              backgroundColor: hotspotColor || marker.color,
                              top: `${marker.yPercentage}%`,
                              left: `${marker.xPercentage}%`,
                            }}
                            onDoubleClick={() => {
                              handleMarkerClick(marker);
                              setSettings({
                                ...settings,
                                verticalValue: marker.x,
                                horizonalValue: marker.y,
                                heading: marker.product,
                              });
                            }}
                          >
                            <HotspotButton />
                          </div>
                        </Draggable>
                      ),
                  )}
                </div>

                <div ref={rightImageRef} className="relative">
                  <img
                    src={
                      currentPage + 1 < images.length
                        ? images[currentPage + 1].url
                        : images[currentPage].url
                    }
                    alt={`Page ${currentPage + 2}`}
                    className="w-full  h-full cursor-crosshair object-contain rounded-tr-lg rounded-br-lg"
                    onClick={(event) =>
                      handleImageMarker(event, rightImageRef, currentPage + 1)
                    }
                  />

                  {markers.map(
                    (marker, index) =>
                      marker.imageIndex === currentPage + 1 && (
                        <Draggable
                          key={marker.pointId}
                          onStop={(e: any) =>
                            handleDragStop(e, rightImageRef, index)
                          }
                          onDrag={(e: any) =>
                            handleDragStop(e, rightImageRef, index)
                          }
                        >
                          <div
                            className="image-hotspots--pin z-20  absolute flex justify-center items-center  text-sm h-9 w-9 rounded-full shadow-lg cursor-pointer animate-pulse"
                            style={{
                              backgroundColor: hotspotColor || marker.color,
                              top: `${marker.yPercentage}%`,
                              left: `${marker.xPercentage}%`,
                            }}
                            onDoubleClick={() => {
                              handleMarkerClick(marker);
                              setSettings({
                                ...settings,
                                verticalValue: marker.x,
                                horizonalValue: marker.y,
                                heading: marker.product,
                              });
                            }}
                          >
                            <HotspotButton />
                          </div>
                        </Draggable>
                      ),
                  )}
                </div>
              </motion.div>
            </div>

            <div className="flex items-center justify-center w-full mt-2">
              <Pagination
                label="Pagination"
                hasPrevious={currentPage !== 0}
                onPrevious={handlePrevPage}
                hasNext={currentPage + 2 < images.length}
                onNext={handleNextPage}
              />
            </div>
            {selectedMarker && (
              <div className="">
                <div className=" Polaris-Modal-Dialog__Container w-[80%]">
                  <div className="Polaris-Modal-Dialog__Modal Polaris-Modal-Dialog--sizeFullScreen">
                    <div className="Polaris-Box">
                      <div className="Polaris-LegacyCard">
                        <div className="Polaris-MediaCard">
                          <div
                            onClick={() => setSelectedMarker(null)}
                            className="crossbtn cursor-pointer absolute z-20 right-2 top-2"
                          >
                            <Icon source={XIcon} tone="critical" />
                          </div>
                          <div className="Polaris-MediaCard__MediaContainer">
                            <img
                              alt={selectedMarker.product}
                              width="100%"
                              height="100%"
                              className="h-full object-cover"
                              src={
                                selectedMarker.productImage ||
                                "https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                              }
                            />
                          </div>
                          <div className="Polaris-MediaCard__InfoContainer p-6 pt-8 border border-l">
                            <div className="Polaris-Box">
                              <div className="Polaris-BlockStack">
                                <div className="Polaris-InlineStack">
                                  <div>
                                    <h2 className="Polaris-Text--root Polaris-Text--headingLg pb-2">
                                      {selectedMarker.product}
                                    </h2>
                                  </div>
                                </div>
                              </div>
                              <div className="">
                                {/* <p className="Polaris-Text--root Polaris-Text--bodySm pb-2">
                                  {selectedMarker.description ||
                                    // ?.replace(/<p>/g, "")
                                    // ?.replace(/<\/p>/g, "")
                                    // ?.replace("<!---->", "")
                                    "Lorem ipsum dolor sit amet consectetur adipisicing elit. Harum quos unde, dolore facere incidunt voluptates consectetur veritatis recusandae numquam nesciunt voluptate dolor ratione perferendis nam earum tenetur, asperiores maxime aperiam reprehenderit neque debitis deleniti?"}
                                </p> */}
                                <div className="pb-2 flex items-center  gap-2">
                                  <p className="line-through">
                                    {selectedMarker.comparedPrice}
                                  </p>
                                  <p className="text-lg font-semibold">
                                    {selectedMarker.price}
                                  </p>
                                </div>

                                <div className="flex gap-2 items-center">
                                  <Button
                                    onClick={() => {
                                      window.open(
                                        `https://admin.shopify.com/store/${shopName.replaceAll(".myshopify.com", "")}/products/${selectedMarker.productId.split("/").pop()}`,
                                        "_blank",
                                      );
                                    }}
                                  >
                                    View Product
                                  </Button>
                                  <Button
                                    onClick={handleRemoveMarker}
                                    variant="primary"
                                    tone="critical"
                                  >
                                    Remove product
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  className="Polaris-Backdrop"
                  onClick={() => setSelectedMarker(null)}
                ></div>
              </div>
            )}
          </Card>
          <div className="absolute hidden top-2">
            <Card roundedAbove="sm">
              <BlockStack gap="200">
                <Text as="h2" variant="headingSm">
                  Hotspot Settings
                </Text>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm" fontWeight="medium">
                    Setting
                  </Text>
                  <List>
                    <ColorPicker onChange={setColor} color={color} />
                  </List>
                </BlockStack>
                <InlineStack align="end">
                  <ButtonGroup>
                    <Button
                      icon={DeleteIcon}
                      variant="tertiary"
                      tone="critical"
                      onClick={() => {}}
                      accessibilityLabel="Delete"
                    />
                    <Button
                      variant="primary"
                      onClick={() => {}}
                      accessibilityLabel="Save setttings"
                    >
                      Save setttings
                    </Button>
                  </ButtonGroup>
                </InlineStack>
              </BlockStack>
            </Card>
          </div>
        </Layout>
      </Page>
    </div>
  );
};

export default PageFlip;
