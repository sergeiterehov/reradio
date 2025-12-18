import type { Radio } from "./drivers/_radio";
import { BF888Radio } from "./drivers/bf888";
import { RT4DRadio } from "./drivers/rt4d";
import { TK11Radio } from "./drivers/tk11";
import { UV5RRadio } from "./drivers/uv5r";
import { UV5RMiniRadio } from "./drivers/uv5r_mini";
import { UVK5Radio } from "./drivers/uvk5";

export const Demos = new Map<typeof Radio, () => Promise<{ default: string }>>();

Demos.set(BF888Radio, () => import("./images/Baofeng_BF-888.img?hex"));
Demos.set(UV5RRadio, () => import("./images/Baofeng_UV-5R.img?hex"));
Demos.set(RT4DRadio, () => import("./images/Radtel_RT-4D_v3.img?hex"));
Demos.set(UV5RMiniRadio, () => import("./images/Baofeng_UV-5R_Mini.img?hex"));
Demos.set(UVK5Radio, () => import("./images/Quansheng_UV-K5.img?hex"));
Demos.set(TK11Radio, () => import("./images/Quansheng_TK11.img?hex"));
