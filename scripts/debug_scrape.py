import requests

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}

def save_html():
    url = "https://www.pilio.idv.tw/ltobig/list.asp"
    try:
        response = requests.get(url, headers=HEADERS, timeout=15, verify=False)
        response.encoding = 'big5'
        with open("debug_pilio.html", "w", encoding="utf-8") as f:
            f.write(response.text)
        print("Saved debug_pilio.html")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    save_html()
