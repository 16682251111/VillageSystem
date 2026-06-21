import urllib.request, json, os, re

url = 'http://127.0.0.1:5000/api/import-excel'
boundary = '----FormBoundary7MA4YWxk'
filepath = '村民脱敏数据.xlsx'

with open(filepath, 'rb') as f:
    file_data = f.read()

body = (
    f'--{boundary}\r\n'
    f'Content-Disposition: form-data; name="file"; filename="{os.path.basename(filepath)}"\r\n'
    f'Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n'
).encode('utf-8') + file_data + f'\r\n--{boundary}--\r\n'.encode('utf-8')

req = urllib.request.Request(url, data=body,
    headers={'Content-Type': f'multipart/form-data; boundary={boundary}'})
try:
    r = urllib.request.urlopen(req, timeout=120)
    result = json.loads(r.read())
    print('SUCCESS')
    print('code:', result['code'])
    if result['code'] == 0:
        d = result['data']
        print(f'Created: {d["households_created"]} HH, Updated: {d["households_updated"]} HH')
        print(f'Members: {d["members_created"]}')
        if d.get('errors'):
            print('Warnings:', len(d['errors']))
            for e in d['errors'][:5]:
                print(' -', str(e)[:120])
    else:
        print('msg:', result.get('msg'))
        d = result.get('data', {})
        print('Sheets:', d.get('sheets_found', []))
except Exception as e:
    if hasattr(e, 'read'):
        resp = e.read().decode('utf-8', errors='ignore')
        m = re.search(r'<title>(.+?)</title>', resp)
        if m: print('Error:', m.group(1))
        tb = re.findall(r'<pre[^>]*>(.+?)</pre>', resp, re.DOTALL)
        for t in tb[-3:]:
            print(t[:250])
        if not tb:
            print(resp[:400])
    else:
        print('Error:', e)
