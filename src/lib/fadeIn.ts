export default function (node: HTMLElement, test: number) {
    node.style.animation = `fadeIn ${0.4}s cubic-bezier(0,.6,.4,1) ${test * 0.2}s forwards`;
    node.style.opacity = '0';
}
