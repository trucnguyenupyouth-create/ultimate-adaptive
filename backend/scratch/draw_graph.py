import json
import os

coords = {
    "523d3b0b-c9d5-48b5-b4e5-8941d5524627":{"x":1040,"y":3040},
    "c9f6f172-486c-4f99-947a-58fa7427745a":{"x":260,"y":1520},
    "8620f4aa-782e-4182-9438-50cb0c441f71":{"x":520,"y":1520},
    "3d0165d2-9b63-4259-8c8a-6ad42619e815":{"x":780,"y":1520},
    "e2c0d6da-3e25-4b5b-87f9-65ec7e4a590e":{"x":1049.29,"y":-122.24},
    "e4837222-056d-44e6-abd5-fefb517c6f38":{"x":0,"y":0},
    "05d06beb-3c6f-45d1-a151-0f0e38e772f3":{"x":3550.31,"y":38.86},
    "c44df09b-e567-4173-8ccd-fe6d864a8bb7":{"x":3263.48,"y":5.13},
    "1cb2cda4-bdc1-4552-a011-9194b5723240":{"x":520,"y":0},
    "296a5852-c660-4172-8c26-e70058c0eaac":{"x":260,"y":3230},
    "95b00901-5b91-4b6f-b832-45eb1f7fc8b6":{"x":520,"y":3230},
    "3f835ce1-4d29-4000-89c5-3175803add08":{"x":260,"y":1710},
    "f42ef71b-a82f-409a-838e-320ecfeb58d9":{"x":1359.11,"y":-520.84},
    "214f1acb-5671-4dee-afe1-2e39da4841b6":{"x":780,"y":1710},
    "d45374ad-e294-4b49-8ba1-f36ab74d7c43":{"x":780,"y":3230},
    "e341887a-7e05-415d-a0b2-ce1f521ea586":{"x":2021.87,"y":21.18},
    "49f12c64-77d0-45b6-a758-719231413662":{"x":1820.205,"y":-280.315},
    "0d545531-7e1b-4a6d-baa9-5418d4212601":{"x":2829.96,"y":-536.33},
    "96a59a2e-5431-43fa-9507-701d42c92b42":{"x":2524.22,"y":25.70},
    "9cefacfc-261d-4556-bc64-a8e60958ec9f":{"x":2911.81,"y":-15.83},
    "f13f2f58-b3d6-4806-9a21-2f5a59622246":{"x":260,"y":3420},
    "76d31d84-586a-4662-8294-36658a84d30e":{"x":356.54,"y":383.18},
    "35cea142-f504-4418-89fe-0a6caa3a93a5":{"x":780,"y":760},
    "267c9b61-a150-479d-95e2-6647db2337bf":{"x":1040,"y":760},
    "99b44ad0-185a-4897-b0a9-d0e1afdc0dc4":{"x":520,"y":1900},
    "2ceee5b6-021d-46db-b5df-08030916bf4b":{"x":4925.70,"y":-534.75},
    "2b6799b1-caac-4e92-bfd1-415c4b16431e":{"x":780,"y":0},
    "095f17d0-9860-4c78-9ad7-d93b1702af55":{"x":1040,"y":1900},
    "cb9cba24-5074-4b1c-8fb6-84ab98c03a4e":{"x":1040,"y":0},
    "1ac26797-3dd4-489f-83de-5ac0078f4497":{"x":0,"y":2090},
    "5fb891b6-3c61-44dd-8160-7f32b1f0eba2":{"x":0,"y":190},
    "9c934457-4e43-4486-91da-61636059295c":{"x":6159.38,"y":-350.17},
    "a75e022e-e78b-4020-a20b-45f3b0d995dd":{"x":260,"y":190},
    "1b9d9075-03b2-4268-ae90-c86b275dd57b":{"x":520,"y":2090},
    "0323040b-c365-42cb-b247-63e12e283b22":{"x":780,"y":2090},
    "67a0513c-5903-407c-ac71-d0cb6452f193":{"x":520,"y":190},
    "35f1f1bf-093d-45e5-b09f-b9f10b08885b":{"x":1040,"y":2090},
    "a44cc514-3d97-4f27-ad2f-0488badff527":{"x":780,"y":190},
    "e354d061-199b-46b6-85c5-29d02b710520":{"x":0,"y":2280},
    "9e7337f2-bf2d-42ed-b07c-cdad95b0dd14":{"x":1040,"y":190},
    "29d23b91-701f-41c2-b158-b2f1dfff3e40":{"x":260,"y":2280},
    "16a9c281-6cca-40be-8881-0d4e211a43c6":{"x":0,"y":380},
    "be2c9aad-6853-4aab-883b-0893de49b156":{"x":520,"y":2280},
    "e25d070b-5e93-4b51-8954-c6084f4f39d4":{"x":260,"y":380},
    "5ef04784-7d84-4612-a741-05a8e631cfa8":{"x":520,"y":380},
    "60307175-3512-49e9-b35b-4cfe164ef42a":{"x":780,"y":2280},
    "be30a810-a2c6-4c8f-8d7d-aa515d7e49b7":{"x":0,"y":1710},
    "66e748f8-6756-4f7a-8232-b6a4b7d7661f":{"x":1040,"y":2280},
    "8b1f1f16-1194-4f52-90f6-e82157ab7999":{"x":780,"y":380},
    "2446415d-21f2-4e11-9aa8-c80159930491":{"x":0,"y":2470},
    "57767f23-fa58-4d24-a2c3-e2bc436786da":{"x":1040,"y":380},
    "ab3650f9-b9db-458f-be79-83840d990c0a":{"x":260,"y":2470},
    "4138513c-6cc2-41fe-bed2-2b2d4641fc28":{"x":0,"y":570},
    "b378aa44-8389-4c0b-b2d2-5f4c2134d0d1":{"x":520,"y":2470},
    "32caa11b-ee1d-4208-99dd-a8b393b45dd4":{"x":260,"y":570},
    "b2dfdb0c-b3ef-47d6-bb61-a76999c50cef":{"x":780,"y":2470},
    "c333baa7-07c9-435d-8b03-a664244d0f21":{"x":520,"y":570},
    "1acd9cf2-ce93-4f9b-a52c-07710605655d":{"x":1040,"y":2470},
    "3bf438fd-b505-41f5-9864-ce1c914cde8c":{"x":780,"y":570},
    "7c147ca4-23b5-4563-be98-cd0b07af6f6e":{"x":1040,"y":570},
    "da118684-1954-4b4a-ae1e-4a51f3317430":{"x":0,"y":760},
    "1cd105ba-e188-40c5-badb-89b4a475df52":{"x":260,"y":760},
    "ba99a753-23ae-43b9-9355-3010ffeb014a":{"x":7784.75,"y":289.75},
    "64e80095-6942-4c30-84d4-a3aa7a90d5b0":{"x":780,"y":760},
    "6e6c4448-2c54-4921-b742-b881b8626aff":{"x":1040,"y":760},
    "55db8d40-9a2a-431e-b698-008f60325395":{"x":8447.88,"y":523.49},
    "cfccc30d-b050-4965-aae1-cbaf9b43da57":{"x":260,"y":950},
    "ef72e375-eabf-4681-8c12-040ca3211476":{"x":520,"y":950},
    "9f858efa-e459-46d5-96ae-87f78e4cb044":{"x":780,"y":950},
    "a5704763-81c2-4736-8b07-2e1a5c03d86b":{"x":10155.99,"y":11.53},
    "157f19cf-c1a3-404a-90e1-d6192a008f52":{"x":0,"y":1140},
    "df21ae5c-2c33-477f-a08b-986d8dc670dd":{"x":0,"y":2660},
    "6ba006bd-6a36-4444-b244-a33b139df442":{"x":260,"y":1140},
    "4fa12b66-1128-493e-b611-406a0513263f":{"x":260,"y":2660},
    "490bce3f-1e0f-4329-b323-d8b4bd4067ee":{"x":10437.30,"y":-200.70},
    "7ad0a2d3-280f-49d2-b365-fe56c6f77415":{"x":780,"y":1140},
    "029996f3-d339-4d8e-bc20-c6749781d7d9":{"x":520,"y":2660},
    "31d83163-f40e-45a4-a0dc-4c62e47d04cb":{"x":1040,"y":1140},
    "1b6f77fd-25de-4222-9394-fc0c6d2e9653":{"x":780,"y":2660},
    "584cd13f-5d30-4bbc-b0fb-a6e2e910d9af":{"x":0,"y":1330},
    "6703b7cf-7e81-469f-806d-75a12f75e0bc":{"x":1040,"y":2660},
    "fa3d027f-ae4b-46ee-98a2-0ce515abf1ae":{"x":260,"y":1330},
    "5eb3ae7f-7bcc-4d6a-93c5-40d57c142396":{"x":0,"y":2850},
    "5d8322d9-6321-46ea-a2a6-02b028d33242":{"x":10926.49,"y":40.40},
    "79ab5616-b1a2-41e1-a3e7-9766aca1e822":{"x":260,"y":2850},
    "421fc894-1eca-43d7-be57-05f0acc94ee8":{"x":11708.405,"y":-225.49},
    "a3b72f9f-568b-4dc3-bd70-81bbfcea20dc":{"x":520,"y":2850},
    "10c265f3-00b1-4635-b3e1-585648baf3be":{"x":12045.829,"y":8.57},
    "5d9aeebb-1ced-4734-863c-483b40a2a301":{"x":11696.10,"y":259.07},
    "419ac6b1-9561-4858-8171-2cb6c7c5667f":{"x":0,"y":1520},
    "46cb6ae5-33d5-4698-a848-bceaccf306d6":{"x":1040,"y":2850},
    "282b6696-385d-41fb-819a-e12abf9fb2b7":{"x":0,"y":3040},
    "b8e19c1c-fa32-4943-a1c5-6b62b4db4550":{"x":1087.899,"y":295.11},
    "8d59fd5d-ef46-47df-9411-85bad45983cb":{"x":520,"y":3040},
    "0f593454-1bc1-484e-968b-18599b7796f4":{"x":780,"y":3040},
    "b68ce985-f530-48eb-9151-e880cf5a61fb":{"x":520,"y":3420},
    "0164cf7c-e080-4ca0-909b-e292f65af633":{"x":780,"y":3420},
    "959461db-e6ce-44b6-8c5f-25c65ac467e8":{"x":8054.63,"y":1971.44},
    "c16b174e-a25a-43d4-ae15-4a212e75eaef":{"x":8052.656,"y":2227.75},
    "93a0e693-56a1-4140-bbb5-6f27cd2c155b":{"x":8871.93,"y":1845.43},
    "111d3f6a-1d76-4929-bcb5-adc2b7bbe0d6":{"x":520,"y":3610},
    "ff3da98d-995e-4c4c-8e3b-681851c95671":{"x":9089.89,"y":2188.608},
    "33b1d60d-acfc-4736-a239-6d12646115a8":{"x":1040,"y":3610},
    "4a8a5463-5958-48b7-8e90-f536aa889645":{"x":0,"y":3800},
    "cdb87133-898d-431e-9155-b17dacb8d6dd":{"x":520,"y":3800},
    "eecf4177-b5c2-48ea-ac8f-2f11c40c9956":{"x":9880.14,"y":1844.66},
    "656a1d64-f530-4757-88d5-0a96a5397eb7":{"x":780,"y":3800},
    "6c18010c-1818-45cb-9c06-7c4adde88e07":{"x":1040,"y":3800},
    "1e15deb5-5b47-4a71-a5c3-a58858f93fd8":{"x":0,"y":3990},
    "d0d94d7e-8b74-4648-a31e-a722b86957d3":{"x":260,"y":3990}
}

# Normalize and scale coords to fit in a clean visualization SVG
# Bounds
min_x = min(c['x'] for c in coords.values())
max_x = max(c['x'] for c in coords.values())
min_y = min(c['y'] for c in coords.values())
max_y = max(c['y'] for c in coords.values())

# SVG Size config
width = 1600
height = 800
padding = 60

svg_w = width - 2 * padding
svg_h = height - 2 * padding

# Scaling math
def scale_x(x):
    return padding + ((x - min_x) / (max_x - min_x)) * svg_w

def scale_y(y):
    return padding + ((y - min_y) / (max_y - min_y)) * svg_h

# Build SVG content
svg_elements = []

# Background grid
for gx in range(0, 11):
    x_pos = padding + (gx / 10) * svg_w
    svg_elements.append(f'<line x1="{x_pos}" y1="{padding}" x2="{x_pos}" y2="{height - padding}" stroke="#222" stroke-width="1" stroke-dasharray="4 4" />')
for gy in range(0, 6):
    y_pos = padding + (gy / 5) * svg_h
    svg_elements.append(f'<line x1="{padding}" y1="{y_pos}" x2="{width - padding}" y2="{y_pos}" stroke="#222" stroke-width="1" stroke-dasharray="4 4" />')

# Draw links between nodes that are close to help visualize structure
# (We don't know the exact edges here, but we can draw dots and highlight clusters)
node_list = list(coords.items())
for i, (id1, p1) in enumerate(node_list):
    x1, y1 = scale_x(p1['x']), scale_y(p1['y'])
    # Draw nodes
    # Color coding: standard grid is green, right side horizontal chain is blue/orange
    if p1['x'] <= 1200:
        color = '#38bdf8' # Cyan for grid block
        name = "Grid Block"
    elif p1['y'] > 1500:
        color = '#fbbf24' # Yellow/Orange for right bottom cluster
        name = "Lower Right"
    else:
        color = '#f43f5e' # Pink/Rose for right top pathway
        name = "Upper Right"
        
    svg_elements.append(f'<circle cx="{x1}" cy="{y1}" r="7" fill="{color}" stroke="#000" stroke-width="1.5" title="{id1} ({p1["x"]}, {p1["y"]})"/>')

# Output full HTML page
html_content = f"""<!DOCTYPE html>
<html>
<head>
    <title>Graph Layout Visualization</title>
    <style>
        body {{
            background: #0f172a;
            color: #e2e8f0;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 20px;
            margin: 0;
        }}
        h1 {{
            margin-bottom: 5px;
            font-size: 24px;
        }}
        .legend {{
            display: flex;
            gap: 20px;
            margin-bottom: 20px;
            font-size: 14px;
        }}
        .legend-item {{
            display: flex;
            align-items: center;
            gap: 8px;
        }}
        .dot {{
            width: 12px;
            height: 12px;
            border-radius: 50%;
        }}
        svg {{
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 8px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
            max-width: 100%;
        }}
        .coords {{
            font-size: 12px;
            color: #94a3b8;
            margin-top: 15px;
        }}
    </style>
</head>
<body>
    <h1>Graph Layout Coordinates Visualization</h1>
    <div class="legend">
        <div class="legend-item"><div class="dot" style="background: #38bdf8;"></div> Left Grid Block (x &le; 1200)</div>
        <div class="legend-item"><div class="dot" style="background: #f43f5e;"></div> Far Right Chain (Upper)</div>
        <div class="legend-item"><div class="dot" style="background: #fbbf24;"></div> Far Right Chain (Lower)</div>
    </div>
    <svg width="{width}" height="{height}">
        {' '.join(svg_elements)}
    </svg>
    <div class="coords">Bounds: X [{min_x:.0f} to {max_x:.0f}], Y [{min_y:.0f} to {max_y:.0f}] | Total Nodes: {len(coords)}</div>
</body>
</html>
"""

os.makedirs('/Users/admin/ultimate-adaptive/backend/scratch', exist_ok=True)
with open('/Users/admin/ultimate-adaptive/backend/scratch/graph_layout.html', 'w') as f:
    f.write(html_content)

print("HTML generated successfully.")
