class TestHeaderMobileMenu {
    constructor(headerEl) {
        this.headerEl = headerEl;

        // <mobile-header class="mobile_header">
        this.mobileHeader = headerEl.querySelector("mobile-header.mobile_header");

        // The click target inside mobile-header
        this.toggleBtn = this.mobileHeader?.querySelector(".mobile_bar");

        // Dropdown is now OUTSIDE mobile-header, but inside the same <header> section
        this.dropdown = headerEl.querySelector(".mobile_header_dropdown");

        if (!this.mobileHeader || !this.toggleBtn || !this.dropdown) return;

        this.onDocClick = this.onDocClick.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onResize = this.onResize.bind(this);

        // Init closed
        this.close();

        this.toggleBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggle();
        });

        document.addEventListener("click", this.onDocClick);
        document.addEventListener("keydown", this.onKeyDown);
        window.addEventListener("resize", this.onResize);
    }

    isOpen() {
        return this.mobileHeader.getAttribute("data-open") === "true";
    }

    open() {
        this.mobileHeader.setAttribute("data-open", "true");
        this.toggleBtn.setAttribute("aria-expanded", "true");

        // If you use max-height animation, keep dropdown in flow (recommended)
        this.dropdown.classList.add("is-open");
    }

    close() {
        this.mobileHeader.setAttribute("data-open", "false");
        this.toggleBtn.setAttribute("aria-expanded", "false");
        this.dropdown.classList.remove("is-open");
    }

    toggle() {
        this.isOpen() ? this.close() : this.open();
    }

    onDocClick(e) {
        // If click is inside the header or dropdown, ignore
        if (this.headerEl.contains(e.target)) return;
        this.close();
    }

    onKeyDown(e) {
        if (e.key === "Escape") this.close();
    }

    onResize() {
        // Close when switching to desktop layout
        if (window.matchMedia("(min-width: 750px)").matches) this.close();
    }
}

// Init header on the page
document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("header.test-header, header.shopify-section.test-header").forEach((hdr) => {
        if (hdr.__mhInit) return;
        hdr.__mhInit = true;
        new TestHeaderMobileMenu(hdr);
    });
});
