import type { Radio } from "./radio";
import { BF888Radio } from "./bf888";
import { RB18Radio, RB618Radio, T18Radio } from "./radtel_t18";
import { UV16ProHPRadio, UV16ProRadio, UV5RRadio, UV82HPRadio, UV82Radio } from "./uv5r";
import { UVK5ProgRadio, UVK5Radio } from "./uvk5";
import { BFC50Radio } from "./bfc50";
import { TK11Radio } from "./tk11";
import { UV5RMiniRadio } from "./uv5r_mini";
import { RT4DRadio } from "./rt4d";

export const Library: (typeof Radio)[] = [
  BF888Radio,
  BFC50Radio,
  UV5RRadio,
  UV5RMiniRadio,
  UV82Radio,
  UV82HPRadio,
  UV16ProRadio,
  UV16ProHPRadio,
  UVK5Radio,
  UVK5ProgRadio,
  TK11Radio,
  T18Radio,
  RT4DRadio,
  RB18Radio,
  RB618Radio,
];

export const Demos = new Map<typeof Radio, () => Promise<{ default: string }>>();

Demos.set(BF888Radio, () => import("../images/Baofeng_BF-888.img?hex"));
Demos.set(UV5RRadio, () => import("../images/Baofeng_UV-5R.img?hex"));
Demos.set(RT4DRadio, () => import("../images/Radtel_RT-4D_v3.img?hex"));
Demos.set(UV5RMiniRadio, () => import("../images/Baofeng_UV-5R_Mini.img?hex"));
Demos.set(UVK5Radio, () => import("../images/Quansheng_UV-K5.img?hex"));
Demos.set(TK11Radio, () => import("../images/Quansheng_TK11.img?hex"));
