import bf888_img from "../images/Baofeng_BF-888.img?hex";
import uv5r_img from "../images/Baofeng_UV-5R.img?hex";
import uvk5_img from "../images/Quansheng_UV-K5.img?hex";
import { Buffer } from "buffer";
import type { Radio } from "./radio";
import { BF888Radio } from "./bf888";
import { RB18Radio, RB618Radio, T18Radio } from "./radtel_t18";
import { UV16Pro8Radio, UV16ProRadio, UV5RRadio, UV82HPRadio, UV82Radio } from "./uv5r";
import { UVK5ProgRadio, UVK5Radio } from "./uvk5";
import { BFC50Radio } from "./bfc50";

export class Demo_UVK5Radio extends UVK5Radio {
  static Info = {
    ...UVK5Radio.Info,
    vendor: `Demo - ${UVK5Radio.Info.vendor}`,
  };

  constructor() {
    super();
    this.load(Buffer.from(uvk5_img, "hex"));
  }
}

export class Demo_UV5RRadio extends UV5RRadio {
  static Info = {
    ...UV5RRadio.Info,
    vendor: `Demo - ${UV5RRadio.Info.vendor}`,
  };

  constructor() {
    super();
    this.load(Buffer.from(uv5r_img, "hex"));
  }
}

export class Demo_BF888Radio extends BF888Radio {
  static Info = {
    ...BF888Radio.Info,
    vendor: `Demo - ${BF888Radio.Info.vendor}`,
  };

  constructor() {
    super();
    this.load(Buffer.from(bf888_img, "hex"));
  }
}

export const Library: (typeof Radio)[] = [
  BF888Radio,
  BFC50Radio,
  UV5RRadio,
  UV82Radio,
  UV82HPRadio,
  UV16ProRadio,
  UV16Pro8Radio,
  UVK5Radio,
  UVK5ProgRadio,
  T18Radio,
  RB18Radio,
  RB618Radio,
  Demo_BF888Radio,
  Demo_UV5RRadio,
  Demo_UVK5Radio,
];
