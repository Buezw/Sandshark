from playwright.sync_api import sync_playwright
import json, os
from datetime import datetime

def get_rebang_element_text():
    text_list = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        # 访问 rebang.today 并等待网络空闲
        page.goto("https://rebang.today/", timeout=60000, wait_until="networkidle")
        try:
            # 等待列表第一个热搜项出现
            page.wait_for_selector("xpath=/html/body/div[1]/div/div[2]/div[2]/main/div/div[2]/div[2]/li[1]", timeout=60000)
        except Exception as e:
            print("等待 rebang 数据加载超时：", e)
        # 爬取 rebang.today 上的前 10 个热搜项
        for i in range(1, 11):
            xpath = f"xpath=/html/body/div[1]/div/div[2]/div[2]/main/div/div[2]/div[2]/li[{i}]/div[2]/div/div/a/div[1]/h2"
            element = page.locator(xpath)
            if element.count() == 0:
                print(f"未找到 rebang 索引为 {i} 的元素")
                continue
            text_list.append(element.inner_text())
        browser.close()
    return text_list

def get_google_trends_text():
    text_list = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        # 访问 Google Trends 并等待网络空闲
        page.goto("https://trends.google.com/trending?geo=US", timeout=60000, wait_until="networkidle")
        try:
            # 等待热搜列表所在的 table 元素加载
            page.wait_for_selector("xpath=/html/body/c-wiz/div/div[5]/div[1]/c-wiz/div/div[2]/div[1]/div[1]/div[1]/table", timeout=60000)
        except Exception as e:
            print("等待 Google Trends 数据加载超时：", e)
        # 爬取 Google Trends 上前 11 个热搜项
        for i in range(1, 12):
            xpath = f"xpath=/html/body/c-wiz/div/div[5]/div[1]/c-wiz/div/div[2]/div[1]/div[1]/div[1]/table/tbody[2]/tr[{i}]/td[2]/div[1]"
            element = page.locator(xpath)
            if element.count() == 0:
                print(f"未找到 Google Trends 索引为 {i} 的元素")
                continue
            text_list.append(element.inner_text())
        browser.close()
    return text_list

if __name__ == "__main__":
    # 爬取 rebang.today 数据
    rebang_trends = get_rebang_element_text()
    # 爬取 Google Trends 数据
    google_trends = get_google_trends_text()

    trends_dir = os.path.join(os.getcwd(), "./static/")
    if not os.path.exists(trends_dir):
        os.makedirs(trends_dir)

    # 添加最后更新时间
    all_trends = {
        "rebang": rebang_trends,
        "google": google_trends,
        "last_update": datetime.now().isoformat()
    }

    # 保存合并的数据到 trends.json
    file_path_all = os.path.join(trends_dir, "trends.json")
    with open(file_path_all, "w", encoding="utf-8") as f:
        json.dump(all_trends, f, ensure_ascii=False, indent=4)
    print("所有热搜数据已合并并保存成功")
