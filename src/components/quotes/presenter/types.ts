export interface PresenterSlide {
  id: string;
  node: React.ReactNode;
  /** Title/thank-you slides fill the whole viewport with their own background; everything else sits in the shell's padded, scrollable frame. */
  fullBleed?: boolean;
}
