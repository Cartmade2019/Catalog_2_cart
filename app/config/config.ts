import { buttonsNameTypes, HotspotProps, IconItems } from "../constants/types";

import { IconSource } from "@shopify/polaris";
import {
  XIcon,
  ClipboardIcon,
  CollectionIcon,
  CreditCardIcon,
  DeliveryIcon,
  ArrowRightIcon,
  CartIcon,
} from "@shopify/polaris-icons";
import AnimationTypes from "../components/AnimationTypes";
import AppSettings from "../components/AppSettings";
import ButtonDesign from "../components/ButtonDesign";
import ToolTipSettings from "../components/ToolTipSettings";

export const buttonsName: buttonsNameTypes[] = [
  { index: 1, link: "app", name: "App", component: AppSettings },
  {
    index: 2,
    link: "buttonDesign",
    name: "Button Design",
    component: ButtonDesign,
  },
  {
    index: 3,
    link: "tooltipDesign",
    name: "Tooltip Design",
    component: ToolTipSettings,
  },
  // {
  //   index: 4,
  //   link: "animationTypes",
  //   name: "Animation Types",
  //   component: AnimationTypes,
  // },
];

export const buttonDesigns: HotspotProps[] = [
  {
    id: "button-1",
    svg: '<svg width="50" height="50" xmlns="http://www.w3.org/2000/svg"><circle cx="25" cy="25" r="25" fill="currentColor" /></svg>',
    color: "#007c68",
    hoverColor: "#005d4a",
    label: "Green Circle",
  },
  {
    id: "button-2",
    svg: '<svg width="50" height="50" xmlns="http://www.w3.org/2000/svg"><rect width="50" height="50" fill="currentColor" /></svg>',
    color: "#f0a500",
    hoverColor: "#d77c00",
    label: "Orange Square",
  },
  {
    id: "button-3",
    svg: '<svg width="50" height="50" xmlns="http://www.w3.org/2000/svg"><polygon points="25,0 50,50 0,50" fill="currentColor" /></svg>',
    color: "#6b42f5",
    hoverColor: "#4b2d99",
    label: "Purple Triangle",
  },
  {
    id: "button-4",
    svg: '<svg width="50" height="50" xmlns="http://www.w3.org/2000/svg"><ellipse cx="25" cy="25" rx="25" ry="25" fill="currentColor" /></svg>',
    color: "#ff4f00",
    hoverColor: "#cc3b00",
    label: "Red Ellipse",
  },
  {
    id: "button-5",
    svg: '<svg width="50" height="50" xmlns="http://www.w3.org/2000/svg"><rect width="50" height="50" rx="10" ry="10" fill="currentColor" /></svg>',
    color: "#00bcd4",
    hoverColor: "#008c9e",
    label: "Teal Rounded Square",
  },
];

export const iconItems: IconItems[] = [
  {
    label: "x",
    icon: XIcon,
    name: "XIcon",
  },
  {
    label: "clipboard",
    icon: ClipboardIcon,
    name: "ClipboardIcon",
  },
  {
    label: "collection",
    icon: CollectionIcon,
    name: "CollectionIcon",
  },
  {
    label: "bag",
    icon: DeliveryIcon,
    name: "DeliveryIcon",
  },
  {
    label: "card",
    icon: CreditCardIcon,
    name: "CreditCardIcon",
  },
  {
    label: "right",
    icon: ArrowRightIcon,
    name: "ArrowRightIcon",
  },
  {
    label: "cart",
    icon: CartIcon,
    name: "CartIcon",
  },
];
