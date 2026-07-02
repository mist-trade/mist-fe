import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import RouteError from "../error";
import GlobalError from "../global-error";

describe("route error boundaries", () => {
  it("renders a route error state with a reset action", () => {
    const reset = jest.fn();

    render(<RouteError error={new Error("chart failed")} reset={reset} />);

    expect(screen.getByRole("alert")).toHaveTextContent("无法显示当前页面");
    fireEvent.click(screen.getByRole("button", { name: "重试" }));

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("renders a global error document with localized metadata", () => {
    const error = Object.assign(new Error("root failed"), { digest: "abc123" });

    const markup = renderToStaticMarkup(
      <GlobalError error={error} reset={jest.fn()} />
    );

    expect(markup).toContain('<html lang="zh-CN">');
    expect(markup).toContain("全局错误");
    expect(markup).toContain("错误编号 abc123");
    expect(markup).toContain("重试");
  });
});
