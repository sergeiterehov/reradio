import type { Radio } from "./radio";
import { BFC50Radio, RB618Radio } from "./radtel_t18";

export const Library: (typeof Radio)[] = [RB618Radio, BFC50Radio];
