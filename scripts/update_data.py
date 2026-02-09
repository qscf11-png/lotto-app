import requests
import json
import re
import time
from datetime import datetime
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}

def create_session():
    session = requests.Session()
    retry = Retry(connect=3, backoff_factor=1)
    adapter = HTTPAdapter(max_retries=retry)
    session.mount('http://', adapter)
    session.mount('https://', adapter)
    requests.packages.urllib3.disable_warnings()
    return session

def fetch_big_lotto():
    """
    使用 pilio JSON API 抓取大樂透歷史資料
    API: https://www.pilio.idv.tw/Json_ltonew.asp?Lkind=ltobig&Lindex=XXX&Ldesc=desc
    """
    session = create_session()
    all_draws = []
    
    # 先抓取首頁獲取初始 lastindex
    print("Fetching Big Lotto initial page...")
    try:
        response = session.get("https://www.pilio.idv.tw/ltobig/list.asp", 
                              headers=HEADERS, timeout=15, verify=False)
        response.encoding = 'big5'
        html = response.text
        
        # 解析初始資料
        cells = html.split('<td class="date-cell">')
        for cell in cells[1:]:
            draw = parse_big_lotto_cell(cell)
            if draw:
                all_draws.append(draw)
        
        # 獲取 lastindex
        lastindex_match = re.search(r'id="lastindex"[^>]*value="(\d+)"', html)
        if lastindex_match:
            lastindex = int(lastindex_match.group(1))
        else:
            lastindex = 2383  # 預設值
            
        print(f"Initial: {len(all_draws)} draws, lastindex={lastindex}")
        
    except Exception as e:
        print(f"Error fetching initial page: {e}")
        return []
    
    # 使用 JSON API 抓取更多資料（目標 100+ 期）
    target_draws = 100
    max_iterations = 10  # 最多請求 10 次
    
    for i in range(max_iterations):
        if len(all_draws) >= target_draws:
            break
            
        time.sleep(1)  # 禮貌性延遲
        
        url = f"https://www.pilio.idv.tw/Json_ltonew.asp?Lkind=ltobig&Lindex={lastindex}&Ldesc=desc"
        print(f"Fetching more data from API (iteration {i+1})...")
        
        try:
            response = session.post(url, headers=HEADERS, timeout=15, verify=False)
            data = response.json()
            
            if 'lotto' not in data or len(data['lotto']) == 0:
                print("No more data available")
                break
                
            for item in data['lotto']:
                # JSON 格式: {date: "02/06<br>26(五)", num: "04,12,24,25,39,48", sp: "09", dex: 2383}
                date_raw = item.get('date', '')
                num_raw = item.get('num', '')
                sp_raw = item.get('sp', '')
                lastindex = item.get('dex', lastindex)
                if isinstance(lastindex, str):
                    lastindex = int(lastindex)
                
                # 解析日期 "02/06<br>26(五)" -> "2026/02/06"
                date_match = re.search(r'(\d{2}/\d{2})<br>(\d{2})', date_raw)
                if date_match:
                    md = date_match.group(1)
                    yy = date_match.group(2)
                    full_date = f"20{yy}/{md}"
                    
                    # 解析號碼
                    nums = [int(n) for n in re.findall(r'\d+', num_raw)]
                    if len(nums) >= 6:
                        special = int(sp_raw) if sp_raw.isdigit() else 0
                        
                        # 避免重複
                        if not any(d['date'] == full_date for d in all_draws):
                            all_draws.append({
                                "date": full_date,
                                "main": nums[:6],
                                "special": special
                            })
            
            print(f"Total: {len(all_draws)} draws")
            
        except Exception as e:
            print(f"Error fetching JSON: {e}")
            break
    
    # 按日期排序（新到舊）
    all_draws.sort(key=lambda x: x['date'], reverse=True)
    print(f"Found {len(all_draws)} Big Lotto draws total.")
    return all_draws

def parse_big_lotto_cell(cell):
    """解析 HTML cell 為 draw dict"""
    date_match = re.search(r'(\d{2}/\d{2})<br>(\d{2})', cell)
    if not date_match:
        return None
    
    md = date_match.group(1)
    yy = date_match.group(2)
    full_date = f"20{yy}/{md}"
    
    num_cell_match = re.search(r'class="number-cell">\s*(.*?)\s*</td>', cell, re.DOTALL)
    if not num_cell_match:
        return None
    
    num_text = num_cell_match.group(1).replace('&nbsp;', ' ').replace(',', ' ')
    nums = [int(n) for n in re.findall(r'\d+', num_text)]
    if len(nums) < 6:
        return None
    
    bonus_match = re.search(r'class="bonus-cell">\s*(\d+)\s*</td>', cell)
    if not bonus_match:
        return None
    
    return {
        "date": full_date,
        "main": nums[:6],
        "special": int(bonus_match.group(1))
    }

def fetch_super_lotto():
    """
    使用 pilio JSON API 抓取威力彩歷史資料
    API: https://www.pilio.idv.tw/Json_ltonew.asp?Lkind=lto&Lindex=XXX&Ldesc=desc
    """
    session = create_session()
    all_draws = []
    
    print("Fetching Super Lotto initial page...")
    try:
        response = session.get("https://www.pilio.idv.tw/lto/list.asp", 
                              headers=HEADERS, timeout=15, verify=False)
        response.encoding = 'big5'
        html = response.text
        
        cells = html.split('<td class="date-cell">')
        for cell in cells[1:]:
            draw = parse_super_lotto_cell(cell)
            if draw:
                all_draws.append(draw)
        
        lastindex_match = re.search(r'id="lastindex"[^>]*value="(\d+)"', html)
        if lastindex_match:
            lastindex = int(lastindex_match.group(1))
        else:
            lastindex = 1000
            
        print(f"Initial: {len(all_draws)} draws, lastindex={lastindex}")
        
    except Exception as e:
        print(f"Error fetching initial page: {e}")
        return []
    
    target_draws = 100
    max_iterations = 10
    
    for i in range(max_iterations):
        if len(all_draws) >= target_draws:
            break
            
        time.sleep(1)
        
        url = f"https://www.pilio.idv.tw/Json_ltonew.asp?Lkind=lto&Lindex={lastindex}&Ldesc=desc"
        print(f"Fetching more data from API (iteration {i+1})...")
        
        try:
            response = session.post(url, headers=HEADERS, timeout=15, verify=False)
            data = response.json()
            
            if 'lotto' not in data or len(data['lotto']) == 0:
                print("No more data available")
                break
                
            for item in data['lotto']:
                date_raw = item.get('date', '')
                num_raw = item.get('num', '')
                sp_raw = item.get('sp', '')
                lastindex = item.get('dex', lastindex)
                if isinstance(lastindex, str):
                    lastindex = int(lastindex)
                
                date_match = re.search(r'(\d{2}/\d{2})<br>(\d{2})', date_raw)
                if date_match:
                    md = date_match.group(1)
                    yy = date_match.group(2)
                    full_date = f"20{yy}/{md}"
                    
                    nums = [int(n) for n in re.findall(r'\d+', num_raw)]
                    if len(nums) >= 6:
                        special = int(sp_raw) if sp_raw.isdigit() else 0
                        
                        if not any(d['date'] == full_date for d in all_draws):
                            all_draws.append({
                                "date": full_date,
                                "zone1": nums[:6],
                                "zone2": special
                            })
            
            print(f"Total: {len(all_draws)} draws")
            
        except Exception as e:
            print(f"Error fetching JSON: {e}")
            break
    
    all_draws.sort(key=lambda x: x['date'], reverse=True)
    print(f"Found {len(all_draws)} Super Lotto draws total.")
    return all_draws

def parse_super_lotto_cell(cell):
    """解析 HTML cell 為威力彩 draw dict"""
    date_match = re.search(r'(\d{2}/\d{2})<br>(\d{2})', cell)
    if not date_match:
        return None
    
    md = date_match.group(1)
    yy = date_match.group(2)
    full_date = f"20{yy}/{md}"
    
    num_cell_match = re.search(r'class="number-cell">\s*(.*?)\s*</td>', cell, re.DOTALL)
    if not num_cell_match:
        return None
    
    num_text = num_cell_match.group(1).replace('&nbsp;', ' ').replace(',', ' ')
    nums = [int(n) for n in re.findall(r'\d+', num_text)]
    if len(nums) < 6:
        return None
    
    bonus_match = re.search(r'class="bonus-cell">\s*(\d+)\s*</td>', cell)
    if not bonus_match:
        return None
    
    return {
        "date": full_date,
        "zone1": nums[:6],
        "zone2": int(bonus_match.group(1))
    }

def update_file(big_draws, super_draws):
    if not big_draws or not super_draws:
        print("Insufficient data to update.")
        return

    content = f"""// Auto-generated by update_data.py
// Last Updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
// Big Lotto: {len(big_draws)} draws, Super Lotto: {len(super_draws)} draws

export const BIG_LOTTO_DRAWS = {json.dumps(big_draws, indent=2)};

export const SUPER_LOTTO_DRAWS = {json.dumps(super_draws, indent=2)};
"""
    content = re.sub(r'"(date|main|special|zone1|zone2)":', r'\1:', content)
    
    path = "src/data/draws.js"
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Updated {path}")

if __name__ == "__main__":
    big = fetch_big_lotto()
    super_ = fetch_super_lotto()
    update_file(big, super_)
