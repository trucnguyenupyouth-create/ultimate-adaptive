"""
Generate detailed KC readiness report for Grade 6.
Lists every KC with exactly what's missing for minimum acceptance.
"""
import asyncio
import json
import sys
sys.path.insert(0, "/Users/admin/ultimate-adaptive/backend")

from sqlalchemy import text
from app.core.database import engine

async def main():
    async with engine.connect() as conn:
        # All Grade 6 KCs with full stats
        result = await conn.execute(text("""
            SELECT 
                kc.id::text as id,
                kc.code,
                kc.name,
                kc.grade,
                kc.chapter_info,
                kc.block_id::text as block_id,
                COUNT(DISTINCT i.id) FILTER (WHERE i.is_active = TRUE) AS total_items,
                COUNT(DISTINCT i.id) FILTER (WHERE i.is_active = TRUE AND i.irt_b < -0.5) AS easy_items,
                COUNT(DISTINCT i.id) FILTER (WHERE i.is_active = TRUE AND i.irt_b BETWEEN -0.5 AND 0.5) AS medium_items,
                COUNT(DISTINCT i.id) FILTER (WHERE i.is_active = TRUE AND i.irt_b > 0.5) AS hard_items,
                COUNT(DISTINCT i.id) FILTER (WHERE i.is_active = TRUE AND i.is_diagnostic_anchor = TRUE) AS anchor_items,
                (SELECT COUNT(*) FROM kc_prerequisites e WHERE e.kc_id = kc.id) AS incoming_edges,
                (SELECT COUNT(*) FROM kc_prerequisites e WHERE e.prereq_id = kc.id) AS outgoing_edges
            FROM knowledge_components kc
            LEFT JOIN items i ON i.kc_id = kc.id
            WHERE kc.grade = 6
            GROUP BY kc.id, kc.code, kc.name, kc.grade, kc.chapter_info, kc.block_id
            ORDER BY kc.chapter_info NULLS LAST, kc.code
        """))
        
        rows = result.fetchall()
        
        # Group by chapter/block
        chapters = {}
        for row in rows:
            ch = row.chapter_info or "UNKNOWN"
            # Extract block prefix (e.g., "B1K1" -> "B1")
            block_prefix = ch.split("K")[0] if "K" in ch else ch
            key = f"{block_prefix} ({ch})"
            if key not in chapters:
                chapters[key] = []
            chapters[key].append(row)
        
        # Build report
        lines = []
        lines.append("# Báo cáo Chi tiết Trạng thái KCs — Toán Lớp 6\n")
        lines.append(f"> Generated: 2026-06-20 | Total: {len(rows)} KCs\n")
        
        # Summary
        ready_count = 0
        partial_count = 0
        no_items_count = 0
        isolated_count = 0
        
        all_issues = {
            "no_items": [],
            "items_lt3": [],
            "no_easy": [],
            "no_medium": [],
            "no_hard": [],
            "no_anchor": [],
            "isolated": [],
        }
        
        for row in rows:
            total = row.total_items
            easy = row.easy_items
            med = row.medium_items
            hard = row.hard_items
            anchor = row.anchor_items
            edges = row.incoming_edges + row.outgoing_edges
            
            issues = []
            if total == 0:
                issues.append("no_items")
                all_issues["no_items"].append(row)
                no_items_count += 1
            else:
                if total < 3:
                    issues.append("items_lt3")
                    all_issues["items_lt3"].append(row)
                if easy < 1:
                    issues.append("no_easy")
                    all_issues["no_easy"].append(row)
                if med < 1:
                    issues.append("no_medium")
                    all_issues["no_medium"].append(row)
                if hard < 1:
                    issues.append("no_hard")
                    all_issues["no_hard"].append(row)
                if anchor < 1:
                    issues.append("no_anchor")
                    all_issues["no_anchor"].append(row)
                if issues:
                    partial_count += 1
                else:
                    ready_count += 1
            
            if edges == 0:
                all_issues["isolated"].append(row)
                isolated_count += 1
        
        lines.append("## Tổng quan\n")
        lines.append("| Trạng thái | Số lượng | % |")
        lines.append("|-----------|---------|---|")
        lines.append(f"| ✅ Ready (đủ điều kiện) | {ready_count} | {ready_count*100//len(rows)}% |")
        lines.append(f"| ⚠️ Partial (có items nhưng thiếu) | {partial_count} | {partial_count*100//len(rows)}% |")
        lines.append(f"| 🔴 No Items (chưa có câu hỏi) | {no_items_count} | {no_items_count*100//len(rows)}% |")
        lines.append(f"| 🟣 Isolated (không có edge) | {isolated_count} | {isolated_count*100//len(rows)}% |")
        lines.append("")
        
        # Minimum acceptance criteria
        lines.append("## Tiêu chí tối thiểu (Minimum Acceptance)\n")
        lines.append("Mỗi KC cần đạt **TẤT CẢ** các điều kiện sau:\n")
        lines.append("| # | Tiêu chí | Lý do |")
        lines.append("|---|---------|-------|")
        lines.append("| 1 | ≥ 3 items tổng | IRT cần ≥3 data points để ZPD selection có ý nghĩa |")
        lines.append("| 2 | ≥ 1 easy (irt_b < -0.5) | Weak student cần câu dễ để build confidence |")
        lines.append("| 3 | ≥ 1 medium (-0.5 ≤ irt_b ≤ 0.5) | Entry point cho Cold Start assessment |")
        lines.append("| 4 | ≥ 1 hard (irt_b > 0.5) | Strong student cần câu khó để confirm mastery |")
        lines.append("| 5 | ≥ 1 diagnostic anchor | CAT Cold Start cần anchor item (medium + high discrimination) |")
        lines.append("| 6 | ≥ 1 edge trong graph | KC phải được kết nối trong KST graph |")
        lines.append("")
        
        # Issue summary
        lines.append("## Tổng hợp vấn đề\n")
        lines.append("| Vấn đề | Số KCs bị ảnh hưởng | Mức độ |")
        lines.append("|--------|-------------------|--------|")
        lines.append(f"| 🔴 Không có items nào | {len(all_issues['no_items'])} | CRITICAL — assessment crash nếu traverse qua |")
        lines.append(f"| 🟠 Items < 3 | {len(all_issues['items_lt3'])} | HIGH — IRT ZPD không đủ pool |")
        lines.append(f"| 🟡 Thiếu Easy items | {len(all_issues['no_easy'])} | MEDIUM — weak student frustration |")
        lines.append(f"| 🟡 Thiếu Medium items | {len(all_issues['no_medium'])} | MEDIUM — Cold Start fallback |")
        lines.append(f"| 🟡 Thiếu Hard items | {len(all_issues['no_hard'])} | MEDIUM — strong student ceiling |")
        lines.append(f"| 🟡 Thiếu Anchor items | {len(all_issues['no_anchor'])} | MEDIUM — Cold Start dùng ZPD thay vì anchor |")
        lines.append(f"| ⚪ Isolated (no edges) | {len(all_issues['isolated'])} | LOW — không ảnh hưởng assessment nhưng unreachable |")
        lines.append("")
        
        # Detailed per-KC table
        lines.append("---\n")
        lines.append("## Chi tiết từng KC\n")
        lines.append("> **Cách đọc bảng:**")
        lines.append("> - Cột `E/M/H/A`: số lượng items Easy / Medium / Hard / Anchor")
        lines.append("> - Cột `In/Out`: số edges đến / đi (prerequisite graph)")
        lines.append("> - Cột `Thiếu`: liệt kê cụ thể cần bổ sung gì")
        lines.append("> - Sắp xếp theo chapter_info (B1K1, B2K1, ... B43K2)\n")
        
        # Group by block for better readability
        current_block = None
        
        for row in rows:
            ch = row.chapter_info or "UNKNOWN"
            block_prefix = ch.split("K")[0] if "K" in ch else ch
            
            if block_prefix != current_block:
                current_block = block_prefix
                lines.append(f"\n### Block {block_prefix} ({ch})\n")
                lines.append("| Code | Name | Total | E/M/H/A | In/Out | Status | Thiếu |")
                lines.append("|------|------|-------|---------|--------|--------|-------|")
            
            total = row.total_items
            easy = row.easy_items
            med = row.medium_items
            hard = row.hard_items
            anchor = row.anchor_items
            in_e = row.incoming_edges
            out_e = row.outgoing_edges
            
            name = (row.name or "?")[:40]
            code = row.code or "?"
            
            # Determine issues
            issues = []
            if total == 0:
                issues.append("**TẠO 6 ITEMS** (2E+2M+2H)")
                status = "🔴"
            else:
                if total < 3:
                    need = 3 - total
                    issues.append(f"+{need} items")
                if easy < 1:
                    issues.append("+1 easy (b<-0.5)")
                if med < 1:
                    issues.append("+1 medium")
                if hard < 1:
                    issues.append("+1 hard (b>0.5)")
                if anchor < 1:
                    issues.append("+1 anchor")
                    
                if issues:
                    status = "⚠️"
                else:
                    status = "✅"
            
            if in_e + out_e == 0:
                issues.append("⚠️ isolated")
            
            issues_str = ", ".join(issues) if issues else "—"
            
            lines.append(f"| {code} | {name} | {total} | {easy}/{med}/{hard}/{anchor} | {in_e}/{out_e} | {status} | {issues_str} |")
        
        # Action plan by priority
        lines.append("\n---\n")
        lines.append("## Kế hoạch hành động (Action Plan)\n")
        
        lines.append("### 🔴 Priority 1: KCs có edges nhưng KHÔNG có items (Assessment sẽ CRASH)\n")
        lines.append("Đây là các KC nằm trên đường traverse của KST. Nếu assessment đi qua sẽ trả về `item: null`.\n")
        lines.append("| # | Code | Name | Block | Edges | Action |")
        lines.append("|---|------|------|-------|-------|--------|")
        p1_count = 0
        for row in all_issues["no_items"]:
            edges = row.incoming_edges + row.outgoing_edges
            if edges > 0:
                p1_count += 1
                lines.append(f"| {p1_count} | {row.code} | {(row.name or '?')[:35]} | {row.chapter_info or '?'} | {edges} | Generate 6 MCQs |")
        lines.append(f"\n> **Tổng: {p1_count} KCs** — Phải xử lý trước khi chạy assessment.\n")
        
        lines.append("### 🟠 Priority 2: KCs có items < 3 (IRT ZPD thiếu pool)\n")
        lines.append("| # | Code | Name | Total | Cần thêm |")
        lines.append("|---|------|------|-------|---------|")
        p2_count = 0
        for row in all_issues["items_lt3"]:
            p2_count += 1
            need = 3 - row.total_items
            lines.append(f"| {p2_count} | {row.code} | {(row.name or '?')[:35]} | {row.total_items} | +{need} items |")
        lines.append(f"\n> **Tổng: {p2_count} KCs**\n")
        
        lines.append("### 🟡 Priority 3: KCs thiếu Hard items (phổ biến nhất)\n")
        lines.append("Không có hard items → IRT không thể estimate θ cao → strong student bị underestimate.\n")
        lines.append("| # | Code | Name | Current E/M/H | Action |")
        lines.append("|---|------|------|--------------|--------|")
        p3_count = 0
        for row in all_issues["no_hard"]:
            if row.total_items >= 3:  # already has enough items, just missing hard
                p3_count += 1
                lines.append(f"| {p3_count} | {row.code} | {(row.name or '?')[:35]} | {row.easy_items}/{row.medium_items}/{row.hard_items} | +1 hard (set irt_b=1.5) |")
        lines.append(f"\n> **Tổng: {p3_count} KCs** — Có thể fix bằng cách chuyển 1 medium item thành hard (đổi irt_b=1.5) hoặc generate thêm.\n")
        
        lines.append("### 🟡 Priority 4: KCs thiếu Easy items\n")
        lines.append("| # | Code | Name | Current E/M/H | Action |")
        lines.append("|---|------|------|--------------|--------|")
        p4_count = 0
        for row in all_issues["no_easy"]:
            if row.total_items >= 3:
                p4_count += 1
                lines.append(f"| {p4_count} | {row.code} | {(row.name or '?')[:35]} | {row.easy_items}/{row.medium_items}/{row.hard_items} | +1 easy (set irt_b=-1.0) |")
        lines.append(f"\n> **Tổng: {p4_count} KCs**\n")
        
        lines.append("### 🟡 Priority 5: KCs thiếu Anchor items\n")
        lines.append("Anchor items cần: `is_diagnostic_anchor=TRUE` + `irt_b` trong [-0.4, 0.4].\n")
        lines.append("| # | Code | Name | Total Items | Action |")
        lines.append("|---|------|------|------------|--------|")
        p5_count = 0
        for row in all_issues["no_anchor"]:
            if row.total_items > 0:
                p5_count += 1
                lines.append(f"| {p5_count} | {row.code} | {(row.name or '?')[:35]} | {row.total_items} | Set 1 medium item → is_diagnostic_anchor=TRUE |")
        lines.append(f"\n> **Tổng: {p5_count} KCs** — Fix nhanh: chỉ cần UPDATE 1 medium item.\n")
        
        lines.append("### ⚪ Priority 6: KCs Isolated (không có edges)\n")
        lines.append("Không ảnh hưởng assessment nhưng unreachable — KST không bao giờ navigate tới.\n")
        lines.append("| # | Code | Name | Block | Items | Action |")
        lines.append("|---|------|------|-------|-------|--------|")
        p6_count = 0
        for row in all_issues["isolated"]:
            p6_count += 1
            lines.append(f"| {p6_count} | {row.code} | {(row.name or '?')[:35]} | {row.chapter_info or '?'} | {row.total_items} | Connect to graph hoặc xóa |")
        lines.append(f"\n> **Tổng: {p6_count} KCs**\n")
        
        # Write to file
        report = "\n".join(lines)
        output_path = "/Users/admin/ultimate-adaptive/docs/kc_readiness_report.md"
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(report)
        print(f"Report written to {output_path}")
        print(f"\nSummary:")
        print(f"  ✅ Ready: {ready_count}")
        print(f"  ⚠️ Partial: {partial_count}")
        print(f"  🔴 No Items: {no_items_count}")
        print(f"  🟣 Isolated: {isolated_count}")
        print(f"\nPriority 1 (CRITICAL - has edges, no items): {p1_count}")
        print(f"Priority 2 (items < 3): {p2_count}")
        print(f"Priority 3 (no hard): {p3_count}")
        print(f"Priority 4 (no easy): {p4_count}")
        print(f"Priority 5 (no anchor): {p5_count}")
        print(f"Priority 6 (isolated): {p6_count}")

asyncio.run(main())
