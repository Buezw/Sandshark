from playwright.sync_api import sync_playwright

def get_rebang_element_text():


    text_list = []
    with sync_playwright() as p:

        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("https://rebang.today/", timeout=60000)


        # 等待目标元素加载（可根据实际情况调整等待时间或条件）

        for i in range(1,10):
            xpath = "xpath=/html/body/div[1]/div/div[2]/div[2]/main/div/div[2]/div[2]/li["+str(i)+"]/div[2]/div/div/a/div[1]/h2"
            element = page.locator(xpath)
            if element is None:
                browser.close()
                print(f"未找到索引为{i}的元素")
            text_list.append(element.inner_text())
        browser.close()
        return text_list

# 示例：测试函数
if __name__ == "__main__":
    trends = get_rebang_element_text()
    print(trends)
