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
    session.verify = False 
    requests.packages.urllib3.disable_warnings()
    return session

def fetch_big_lotto():
    # Source: https://www.pilio.idv.tw/ltobig/list.asp
    # This site lists recent draws in a table.
    # format: Date ... Numbers ... Special
    
    url = "https://www.pilio.idv.tw/ltobig/list.asp"
    print(f"Fetching Big Lotto from {url}...")
    
    session = create_session()
    try:
        response = session.get(url, headers=HEADERS, timeout=15, verify=False)
        response.encoding = 'big5'
        html = response.text
        
        # Pilio Structure (from debug):
        # <td class="date-cell">02/06<br>26(五)</td>
        # <td class="number-cell">
        #     04,&nbsp;12,&nbsp;24,&nbsp;25,&nbsp;39,&nbsp;48
        # </td>
        # <td class="bonus-cell">09</td>
        
        # We need to find "date-cell".
        # It contains MM/DD. The year is on next line "26(...)". 
        
        # We can split by <td class="date-cell">
        
        cells = html.split('<td class="date-cell">')
        draws = []
        
        for cell in cells[1:]: # skip first empty chunk
            # cell starts with MM/DD<br>YY...
            # Example: 02/06<br>26(五)</td> ... <td class="number-cell">...
            
            # Extract Date
            date_match = re.search(r'(\d{2}/\d{2})<br>(\d{2})', cell)
            if not date_match: continue
            
            md = date_match.group(1) # 02/06
            yy = date_match.group(2) # 26
            year = "20" + yy
            full_date = f"{year}/{md}"
            
            # Extract Main Numbers
            # They are in <td class="number-cell">
            # 04,&nbsp;12,...
            
            num_cell_match = re.search(r'class="number-cell">\s*(.*?)\s*</td>', cell, re.DOTALL)
            if not num_cell_match: continue
            
            num_text = num_cell_match.group(1)
            # Replace &nbsp; with space, remove commas
            num_text = num_text.replace('&nbsp;', ' ').replace(',', ' ')
            
            # Find 6 numbers
            nums = [int(n) for n in re.findall(r'\d+', num_text)]
            if len(nums) < 6: continue
            main = nums[:6]
            
            # Extract Special
            # <td class="bonus-cell">09</td>
            bonus_match = re.search(r'class="bonus-cell">\s*(\d+)\s*</td>', cell)
            if not bonus_match: continue
            special = int(bonus_match.group(1))
            
            draws.append({
                "date": full_date,
                "main": main,
                "special": special
            })


        print(f"Found {len(draws)} Big Lotto draws.")
        return draws

    except Exception as e:
        print(f"Error fetching Big Lotto: {e}")
        return []

def fetch_super_lotto():
    # Source: https://www.pilio.idv.tw/lto/list.asp
    url = "https://www.pilio.idv.tw/lto/list.asp"
    print(f"Fetching Super Lotto from {url}...")
    
    session = create_session()
    try:
        response = session.get(url, headers=HEADERS, timeout=15, verify=False)
        response.encoding = 'big5'
        html = response.text
        
        # Super Lotto (Lotto38) uses similar structure
        cells = html.split('<td class="date-cell">')
        draws = []
        
        for cell in cells[1:]:
            date_match = re.search(r'(\d{2}/\d{2})<br>(\d{2})', cell)
            if not date_match: continue
            
            md = date_match.group(1)
            yy = date_match.group(2)
            full_date = f"20{yy}/{md}"
            
            num_cell_match = re.search(r'class="number-cell">\s*(.*?)\s*</td>', cell, re.DOTALL)
            if not num_cell_match: continue
            
            num_text = num_cell_match.group(1).replace('&nbsp;', ' ').replace(',', ' ')
            nums = [int(n) for n in re.findall(r'\d+', num_text)]
            if len(nums) < 6: continue
            main = nums[:6]
            
            bonus_match = re.search(r'class="bonus-cell">\s*(\d+)\s*</td>', cell)
            if not bonus_match: continue
            special = int(bonus_match.group(1))
            
            draws.append({
                "date": full_date,
                "zone1": main,
                "zone2": special
            })

        print(f"Found {len(draws)} Super Lotto draws.")
        return draws

    except Exception as e:
        print(f"Error fetching Super Lotto: {e}")
        return []

def update_file(big_draws, super_draws):
    # Take top 100
    big_draws = big_draws[:100]
    super_draws = super_draws[:100]
    
    if not big_draws or not super_draws:
        print("Insufficient data to update.")
        return

    content = f"""// Auto-generated by update_data.py
// Last Updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

export const BIG_LOTTO_DRAWS = {json.dumps(big_draws, indent=2)};

export const SUPER_LOTTO_DRAWS = {json.dumps(super_draws, indent=2)};
"""
    # Remove quotes from keys for cleaner JS
    content = re.sub(r'"(date|main|special|zone1|zone2)":', r'\1:', content)
    
    path = "src/data/draws.js"
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Updated {path}")

if __name__ == "__main__":
    big = fetch_big_lotto()
    super_ = fetch_super_lotto()
    update_file(big, super_)
