declare module 'html2pdf.js' {
  interface Html2PdfOptions {
    margin?: number | number[];
    filename?: string;
    image?: {
      type?: string;
      quality?: number;
    };
    html2canvas?: {
      scale?: number;
      useCORS?: boolean;
      [key: string]: unknown;
    };
    jsPDF?: {
      unit?: string;
      format?: string;
      orientation?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  }

  interface Html2Pdf {
    set(options: Html2PdfOptions): Html2Pdf;
    from(element: HTMLElement | string): Html2Pdf;
    save(): Promise<void>;
    output(type: string): any;
  }

  function html2pdf(): Html2Pdf;

  export default html2pdf;
}
