import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Register the scroll plugin once for the whole app.
gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };
