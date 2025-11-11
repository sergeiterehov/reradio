import bf888_img from "../images/Baofeng_BF-888.img?hex";
import uv5r_img from "../images/Baofeng_UV-5R.img?hex";
import { Buffer } from "buffer";
import type { Radio } from "./radio";
import { BF888Radio } from "./bf888";
import { BFC50Radio, RB618Radio } from "./radtel_t18";
import { UV5RRadio, UV82HPRadio, UV82Radio } from "./uv5r";
import { K5ProgRadio } from "./k5prog";

export class Demo_UV5RRadio extends UV5RRadio {
  static Info = {
    ...UV5RRadio.Info,
    model: `${UV5RRadio.Info.model} Demo`,
  };

  constructor() {
    super();
    this.load(Buffer.from(uv5r_img, "hex"));
  }
}

export class Demo_BF888Radio extends BF888Radio {
  static Info = {
    ...BF888Radio.Info,
    model: `${BF888Radio.Info.model} Demo`,
  };

  constructor() {
    super();
    this.load(Buffer.from(bf888_img, "hex"));
  }
}

export const Library: (typeof Radio)[] = [
  K5ProgRadio,
  BF888Radio,
  BFC50Radio,
  UV5RRadio,
  UV82Radio,
  UV82HPRadio,
  RB618Radio,
  Demo_BF888Radio,
  Demo_UV5RRadio,
];
