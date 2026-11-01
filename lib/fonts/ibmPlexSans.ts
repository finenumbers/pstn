import localFont from "next/font/local";

/**
 * IBM Plex Sans (latin + cyrillic), SIL OFL.
 * Files live in the repo so the production image does not fetch a font host.
 * Applied only to the ranges table and its portaled filter menu.
 */
export const ibmPlexSans = localFont({
  display: "swap",
  src: [
    {
      path: "../../app/fonts/IBMPlexSans-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../app/fonts/IBMPlexSans-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../app/fonts/IBMPlexSans-SemiBold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../app/fonts/IBMPlexSans-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
});
