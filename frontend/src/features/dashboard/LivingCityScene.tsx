/**
 * Original SVG artwork — no third-party image or shader dependencies.
 * Animated by CSS only, with reduced-motion fallback in experience.css.
 */
export default function LivingCityScene() {
  const nearWindows = Array.from({ length: 12 }, (_, i) => ({ x: 455 + (i % 4) * 45, y: 315 + Math.floor(i / 4) * 61 }));
  const towerWindows = Array.from({ length: 20 }, (_, i) => ({ x: 790 + (i % 4) * 44, y: 275 + Math.floor(i / 4) * 56 }));
  const stars = Array.from({ length: 28 }, (_, i) => ({
    x: 90 + (i * 157 + 43) % 1030,
    y: 56 + (i * 83 + 17) % 365,
    radius: i % 5 === 0 ? 2.4 : 1.1,
  }));

  return (
    <div className="kinship-scene pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <svg viewBox="0 0 1220 780" fill="none" xmlns="http://www.w3.org/2000/svg" className="kinship-scene-svg absolute h-full w-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="sky-grad" x1="490" y1="0" x2="720" y2="780" gradientUnits="userSpaceOnUse">
            <stop stopColor="#163E36" /><stop offset="0.55" stopColor="#10352E"/><stop offset="1" stopColor="#09251F"/>
          </linearGradient>
          <linearGradient id="sun-grad" x1="740" y1="150" x2="980" y2="430" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ECF5CE"/><stop offset="0.58" stopColor="#B8D6A8"/><stop offset="1" stopColor="#83AC8D"/>
          </linearGradient>
          <linearGradient id="glass-grad" x1="390" y1="245" x2="660" y2="650" gradientUnits="userSpaceOnUse">
            <stop stopColor="#6C9082" stopOpacity="0.89"/><stop offset="1" stopColor="#21483F"/>
          </linearGradient>
          <linearGradient id="tower-grad" x1="780" y1="220" x2="1000" y2="710" gradientUnits="userSpaceOnUse">
            <stop stopColor="#4D7968"/><stop offset="1" stopColor="#183B33"/>
          </linearGradient>
          <radialGradient id="bloom-grad" cx="0" cy="0" r="1" gradientTransform="translate(862 282) rotate(90) scale(336)" gradientUnits="userSpaceOnUse">
            <stop stopColor="#B8D5A0" stopOpacity="0.25"/><stop offset="1" stopColor="#B8D5A0" stopOpacity="0"/>
          </radialGradient>
          <filter id="sun-glow" x="520" y="-70" width="700" height="700" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="37"/></filter>
          <filter id="orb-shadow" x="0" y="0" width="1220" height="780" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="12"/></filter>
          <pattern id="scene-grid" width="58" height="58" patternUnits="userSpaceOnUse"><path d="M58 0H0V58" stroke="#EAF4D8" strokeWidth="0.6" opacity=".065"/></pattern>
          <clipPath id="city-clip"><rect x="0" y="0" width="1220" height="780"/></clipPath>
        </defs>

        <g clipPath="url(#city-clip)">
          <rect width="1220" height="780" fill="url(#sky-grad)"/>
          <rect width="1220" height="780" fill="url(#scene-grid)"/>
          <circle cx="862" cy="286" r="350" fill="url(#bloom-grad)"/>
          <circle cx="870" cy="290" r="128" fill="#B6D99A" fillOpacity=".21" filter="url(#sun-glow)"/>
          <circle cx="870" cy="286" r="113" fill="url(#sun-grad)" opacity=".91"/>
          <circle cx="870" cy="286" r="133" stroke="#D7F1C9" opacity=".25" strokeWidth=".8"/>
          <circle cx="870" cy="286" r="166" stroke="#D7F1C9" opacity=".15" strokeWidth=".8"/>
          <circle cx="870" cy="286" r="207" stroke="#D7F1C9" opacity=".12" strokeWidth=".8" strokeDasharray="4 15"/>
          {stars.map((star, i) => <circle key={i} cx={star.x} cy={star.y} r={star.radius} fill="#E4F3D8" opacity={i % 3 === 0 ? ".52" : ".2"}/>)}

          {/* Airborne ecology lanes */}
          <path d="M265 358 C460 255 645 340 808 194 S1080 133 1210 208" stroke="#C7F5AF" strokeWidth="1.3" opacity=".24" strokeDasharray="8 12"/>
          <path d="M300 420 C495 330 676 436 860 342 S1090 307 1180 340" stroke="#C7F5AF" strokeWidth=".75" opacity=".18"/>

          {/* Far neighborhood */}
          <path d="M30 617 V442 L123 424 L210 455 V613" fill="#153D35" stroke="#729E87" strokeOpacity=".3"/>
          <path d="M188 620 V370 L313 344 L376 375 V625" fill="#1B483D" stroke="#709B85" strokeOpacity=".32"/>
          <path d="M1038 650 V367 L1130 342 L1220 369 V657" fill="#1C4B40" stroke="#729E87" strokeOpacity=".22"/>
          {[70,115,245,289,1080,1142,1187].map((x, i)=><path key={i} d={`M${x} ${i>3?410:465}V555`} stroke="#A7CDB0" opacity=".16" strokeWidth="10" strokeDasharray="15 24"/>)}

          {/* Central stepped building */}
          <path d="M355 695 L355 316 L430 302 L430 269 L555 245 L555 275 L634 267 L670 283 L670 695Z" fill="url(#glass-grad)" stroke="#A3CBB1" strokeWidth="1.6" strokeOpacity=".42"/>
          <path d="M355 317L429 302L429 694L354 694Z" fill="#13382F" opacity=".83"/>
          <path d="M430 268L555 245L670 283L544 305Z" fill="#9DAD91" opacity=".56"/>
          <path d="M435 304 L544 326 L667 287" stroke="#BFE4B4" strokeOpacity=".3" strokeWidth="2"/>
          <path d="M430 339L666 323M430 403L666 384M430 467L666 445M430 531L666 505M430 595L666 567" stroke="#B5D9B7" strokeWidth="2.2" strokeOpacity=".45"/>
          {nearWindows.map((w,i)=><rect key={i} x={w.x} y={w.y} width="24" height="29" rx="2" fill={i % 3 === 0 ? "#D2EAC3" : "#91C2AE"} fillOpacity={i % 3 === 0 ? ".55" : ".19"}/>)}
          {[338,402,466,530].map((y,i)=><g key={i}>
            <path d={`M409 ${y}L666 ${y-16}`} stroke="#C6DAB9" strokeWidth="7" strokeLinecap="round" opacity=".54"/>
            <path d={`M470 ${y-7}q22-22 44 0t42-10t40 0`} stroke="#7BA980" strokeWidth="12" opacity=".93" strokeLinecap="round"/>
            <path d={`M453 ${y-6}q10-26 18-10m91 5q10-24 19-6m28 5q9-19 16-7`} stroke="#BFDBA1" strokeWidth="6" strokeLinecap="round" opacity=".62"/>
          </g>)}
          {/* Floating curved walkway */}
          <path d="M304 566 Q518 517 706 561 T1110 530" stroke="#D4E7B8" strokeOpacity=".18" strokeWidth="26"/>
          <path d="M304 563 Q518 515 706 558 T1110 527" stroke="#C6DDB7" strokeOpacity=".56" strokeWidth="2"/>

          {/* Right tower */}
          <path d="M731 707L746 272L804 230L943 218L989 264L1003 707Z" fill="url(#tower-grad)" stroke="#A2C7AA" strokeOpacity=".55" strokeWidth="1.4"/>
          <path d="M749 273 L805 231L802 704L729 705Z" fill="#10352F" opacity=".68"/>
          <path d="M805 230L941 219L991 264L852 285Z" fill="#8BA98E" opacity=".7"/>
          {[312,365,420,475,530,585].map((y,i)=><g key={i}>
            <path d={`M789 ${y}L983 ${y-8}`} stroke="#D4EDC5" strokeWidth="2" opacity=".38"/>
            <path d={`M791 ${y-11}C829 ${y-38} 847 ${y-6} 884 ${y-21}S952 ${y-25} 982 ${y-12}`} stroke={i%2===0?"#86B185":"#B0C995"} strokeWidth="13" opacity=".82" strokeLinecap="round"/>
          </g>)}
          {towerWindows.map((w,i)=><rect key={i} x={w.x} y={w.y} width="18" height="20" rx="2" fill="#E5F9C9" opacity={i%4===0?".44":".14"}/>)}
          {/* Building rooftop plants */}
          <g strokeLinecap="round">
            <path d="M805 222Q806 169 779 150M830 220Q841 174 861 149M885 214Q884 158 900 144M926 215Q951 171 978 169" stroke="#B4D7A1" strokeWidth="4"/>
            <path d="M781 172q-28-9-26-32q29 4 26 32ZM803 169q-23-23-9-36q19 14 9 36ZM843 181q12-39 33-36q-6 32-33 36ZM904 156q3-27 29-30q-3 25-29 30ZM951 187q15-33 42-25q-14 27-42 25Z" fill="#88B897"/>
          </g>

          {/* Foreground urban forest */}
          <path d="M0 649C185 602 344 653 522 647S916 592 1220 637V780H0Z" fill="#10352C"/>
          <path d="M0 684C207 643 368 700 573 682S963 658 1220 681V780H0Z" fill="#0C2C24"/>
          <path d="M0 728C180 687 364 732 555 721S978 682 1220 717V780H0Z" fill="#09251F"/>
          {[83,182,272,348,680,1060,1150].map((x,i)=><g key={i}>
            <path d={`M${x} 730V${555+(i%3)*30}`} stroke="#46725B" strokeWidth="8"/>
            <ellipse cx={x} cy={555+(i%3)*29} rx={39+(i%2)*12} ry="66" fill={i%3===0?"#335F4A":"#457657"}/>
            <ellipse cx={x-13} cy={540+(i%3)*29} rx="18" ry="48" fill="#67946B" opacity=".44"/>
          </g>)}
          <path d="M0 713Q240 673 461 710T951 704T1220 690" stroke="#C3D8AC" strokeWidth="1" opacity=".23"/>

          {/* Birds, insect, motion trails */}
          <g className="kinship-bird kinship-bird-one" stroke="#E3F2D0" strokeLinecap="round" strokeWidth="2.4">
            <path d="M603 196 Q622 183 637 195 Q653 179 671 188"/>
            <path d="M623 198Q639 202 657 194" opacity=".5"/>
          </g>
          <g className="kinship-bird kinship-bird-two" stroke="#E3F2D0" strokeLinecap="round" strokeWidth="1.8" opacity=".65">
            <path d="M1009 150Q1021 141 1036 152Q1050 143 1064 150"/>
          </g>
          <g className="kinship-pollen">
            <circle cx="681" cy="403" r="4" fill="#EFDDAC"/><circle cx="681" cy="403" r="12" stroke="#E2D79A" strokeDasharray="2 6" opacity=".44"/>
          </g>

          {/* Data brackets: intentionally decorative; no fake live measurements */}
          <path d="M992 105H1054V166" stroke="#D9F0BF" opacity=".36"/>
          <path d="M400 565H341V622" stroke="#D9F0BF" opacity=".23"/>
          <circle cx="992" cy="105" r="3" fill="#D5F0BB"/>
        </g>
      </svg>
      <div className="kinship-scene-coordinate kinship-scene-coordinate-one" aria-hidden="true"><span className="kinship-scene-coordinate-point" /> Habitat connection / 07</div>
      <div className="kinship-scene-coordinate kinship-scene-coordinate-two" aria-hidden="true"><span className="kinship-scene-coordinate-point" /> Shared airspace / 03</div>
      <div className="kinship-scene-bottom-label" aria-hidden="true"><span>FIG. 001</span><span>Imagined future / 2126</span></div>
    </div>
  );
}
