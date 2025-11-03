import { BF888Radio } from "./bf888";
import type { Radio } from "./radio";
import { BFC50Radio, RB618Radio } from "./radtel_t18";

export const Library: (typeof Radio)[] = [BF888Radio, BFC50Radio, RB618Radio];

import img from "../images/Baofeng_BF-888.img?hex";
import { Buffer } from "buffer";
export class DemoRadio extends BF888Radio {
  static Info = {
    ...BF888Radio.Info,
    model: `${BF888Radio.Info.model} Demo`,
  };

  constructor() {
    super();
    this.load(Buffer.from(img, "hex"));
  }
}
Library.unshift(DemoRadio);
