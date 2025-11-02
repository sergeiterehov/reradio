import type { Radio } from "./radio";
import { BFC50DemoRadio, BFC50Radio, RB618Radio } from "./radtel_t18";

export const Library: (typeof Radio)[] = [BFC50DemoRadio, RB618Radio, BFC50Radio];
