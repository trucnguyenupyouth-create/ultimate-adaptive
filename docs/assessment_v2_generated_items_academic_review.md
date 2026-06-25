# Assessment V2 — Generated Open Diagnostic Items for Academic Review

**Status:** AI draft for academic review  
**Scope:** Grade 6 Algebra / Non-Geometry Assessment V2 pilot  
**Generated clusters included:**

1. Fractions equivalence và operations — 7 items
2. Decimals, percent, ratio — 5 items + 1 gap record
3. Expressions & order of operations — 5 items
4. Integers & order — 4 items
5. Number foundations & divisibility — 5 items
6. Data/statistics/probability, non-visual — 3 items + 2 gap records

**Total generated draft items:** 29  
**Total gap records:** 3

---

## 0. Global Review Notes for Academic Team

### 0.1. V2 authoring rule applied

All items below are drafted as **open-ended diagnostic items**, not MCQ.

The current V1 MCQ bank was used only for:

- identifying existing KC pools;
- extracting common misconceptions from distractors;
- converting concrete MCQ items into open-ended calculation items where appropriate;
- detecting data/tagging issues.

**No V1 MCQ IRT parameters are carried over.** MCQ guessing rate and open-ended guessing rate are not equivalent.

### 0.2. Inference rule applied

Per Assessment V2 playbook, AI draft items are **never** allowed to self-mark:

```json
"inference_strength": "strong",
"academic_reviewed": true
```

Therefore every item below intentionally has:

```json
"inference_strength": "weak",
"academic_reviewed": false
```

Academic team may later approve/revise/reject and set stronger inference if justified.

### 0.3. Auto-grading caution

Several items use `answer_type="short_text"` because the current schema has no richer expression / binary / explanation fields. These items require backend normalization or structured redesign before production use.

Recommended normalization:

- trim spaces;
- normalize Vietnamese accents where appropriate;
- normalize `,` and `.` in decimal answers;
- normalize set separators: `;`, `,`, whitespace;
- normalize power notation: `5⁵`, `5^5`, `5 mũ 5`;
- normalize optional prefixes such as `M =`.

### 0.4. Bridge item caution

Items marked as **bridge item** require multiple KCs. If student answers incorrectly, do not infer gap in only the primary KC without checking `common_wrong_patterns`.

---

# 1. Fractions Equivalence và Operations — 7 Items

```json
[
  {
    "kc_id": "b68ce985-f530-48eb-9151-e880cf5a61fb",
    "question": "Trong các cách viết sau: 3/4, 5/0, -2/7, 0/9. Cách viết nào KHÔNG phải là phân số hợp lệ? Nêu lí do ngắn gọn.",
    "answer_type": "short_text",
    "accepted_answers": [
      "5/0 vì mẫu số bằng 0",
      "5/0 vì mẫu bằng 0",
      "5/0, mẫu số bằng 0",
      "5/0, mẫu bằng 0"
    ],
    "tolerance": null,
    "difficulty_label": "anchor",
    "is_diagnostic_anchor": true,
    "requires_kcs": [],
    "diagnoses_kcs": [
      "b68ce985-f530-48eb-9151-e880cf5a61fb"
    ],
    "inference_strength": "weak",
    "academic_reviewed": false,
    "common_wrong_patterns": [
      {
        "pattern": "-2/7",
        "mode": "contains",
        "diagnosis": "Tưởng phân số không được có tử số âm",
        "diagnoses_kcs": [
          "b68ce985-f530-48eb-9151-e880cf5a61fb"
        ]
      },
      {
        "pattern": "0/9",
        "mode": "contains",
        "diagnosis": "Tưởng phân số không được có tử số bằng 0",
        "diagnoses_kcs": [
          "b68ce985-f530-48eb-9151-e880cf5a61fb"
        ]
      },
      {
        "pattern": "3/4",
        "mode": "contains",
        "diagnosis": "Không nhận ra tử và mẫu là số nguyên, mẫu khác 0 thì là phân số hợp lệ",
        "diagnoses_kcs": [
          "b68ce985-f530-48eb-9151-e880cf5a61fb"
        ]
      }
    ],
    "flags": [
      "short_text cần academic review rubric; có thể tách thành 2 field nếu hệ thống muốn auto-grade cứng hơn"
    ]
  },
  {
    "kc_id": "0164cf7c-e080-4ca0-909b-e292f65af633",
    "question": "Hai phân số 6/8 và 9/12 có bằng nhau không? Trả lời \"có\" hoặc \"không\".",
    "answer_type": "short_text",
    "accepted_answers": [
      "có",
      "co",
      "bằng nhau",
      "bang nhau",
      "="
    ],
    "tolerance": null,
    "difficulty_label": "anchor",
    "is_diagnostic_anchor": true,
    "requires_kcs": [
      "b68ce985-f530-48eb-9151-e880cf5a61fb"
    ],
    "diagnoses_kcs": [
      "0164cf7c-e080-4ca0-909b-e292f65af633"
    ],
    "inference_strength": "weak",
    "academic_reviewed": false,
    "common_wrong_patterns": [
      {
        "pattern": "không",
        "mode": "contains",
        "diagnosis": "So sánh tử với tử và mẫu với mẫu trực tiếp, không dùng điều kiện nhân chéo",
        "diagnoses_kcs": [
          "0164cf7c-e080-4ca0-909b-e292f65af633"
        ]
      },
      {
        "pattern": "khong",
        "mode": "contains",
        "diagnosis": "So sánh hình thức 6 khác 9 và 8 khác 12 nên kết luận sai là không bằng nhau",
        "diagnoses_kcs": [
          "0164cf7c-e080-4ca0-909b-e292f65af633"
        ]
      }
    ],
    "flags": [
      "Nếu muốn tránh short_text, UI nên cho học sinh chọn Có/Không nhưng backend vẫn lưu item dạng binary"
    ]
  },
  {
    "kc_id": "959461db-e6ce-44b6-8c5f-25c65ac467e8",
    "question": "Rút gọn phân số 18/24 về dạng tối giản.",
    "answer_type": "fraction",
    "accepted_answers": [
      "3/4"
    ],
    "tolerance": null,
    "difficulty_label": "anchor",
    "is_diagnostic_anchor": true,
    "requires_kcs": [
      "b68ce985-f530-48eb-9151-e880cf5a61fb",
      "be2c9aad-6853-4aab-883b-0893de49b156"
    ],
    "diagnoses_kcs": [
      "959461db-e6ce-44b6-8c5f-25c65ac467e8"
    ],
    "inference_strength": "weak",
    "academic_reviewed": false,
    "common_wrong_patterns": [
      {
        "pattern": "9/12",
        "mode": "exact",
        "diagnosis": "Có chia cả tử và mẫu cho cùng một số nhưng chưa rút gọn đến dạng tối giản",
        "diagnoses_kcs": [
          "959461db-e6ce-44b6-8c5f-25c65ac467e8"
        ]
      },
      {
        "pattern": "6/8",
        "mode": "exact",
        "diagnosis": "Chia cả tử và mẫu cho 3 nhưng chưa tối giản",
        "diagnoses_kcs": [
          "959461db-e6ce-44b6-8c5f-25c65ac467e8"
        ]
      },
      {
        "pattern": "18/24",
        "mode": "exact",
        "diagnosis": "Không thực hiện rút gọn phân số",
        "diagnoses_kcs": [
          "959461db-e6ce-44b6-8c5f-25c65ac467e8"
        ]
      },
      {
        "pattern": "24/18",
        "mode": "exact",
        "diagnosis": "Đảo tử và mẫu thay vì rút gọn",
        "diagnoses_kcs": [
          "959461db-e6ce-44b6-8c5f-25c65ac467e8"
        ]
      }
    ],
    "flags": [
      "requires_kcs có ƯCLN vì yêu cầu dạng tối giản; nếu muốn item chỉ test tính chất phân số, đổi question thành 'Chia cả tử và mẫu của 18/24 cho 6'"
    ]
  },
  {
    "kc_id": "93a0e693-56a1-4140-bbb5-6f27cd2c155b",
    "question": "Quy đồng mẫu hai phân số 2/5 và 3/4 bằng mẫu chung nhỏ nhất. Viết hai phân số mới theo dạng {phân số thứ nhất; phân số thứ hai}.",
    "answer_type": "set",
    "accepted_answers": [
      "{8/20;15/20}",
      "{15/20;8/20}"
    ],
    "tolerance": null,
    "difficulty_label": "anchor",
    "is_diagnostic_anchor": true,
    "requires_kcs": [
      "b68ce985-f530-48eb-9151-e880cf5a61fb",
      "959461db-e6ce-44b6-8c5f-25c65ac467e8",
      "60307175-3512-49e9-b35b-4cfe164ef42a"
    ],
    "diagnoses_kcs": [
      "93a0e693-56a1-4140-bbb5-6f27cd2c155b"
    ],
    "inference_strength": "weak",
    "academic_reviewed": false,
    "common_wrong_patterns": [
      {
        "pattern": "{2/20;3/20}",
        "mode": "exact",
        "diagnosis": "Đổi mẫu số về mẫu chung nhưng quên nhân tử số với thừa số phụ tương ứng",
        "diagnoses_kcs": [
          "93a0e693-56a1-4140-bbb5-6f27cd2c155b"
        ]
      },
      {
        "pattern": "{8/9;15/9}",
        "mode": "exact",
        "diagnosis": "Dùng tổng hai mẫu số làm mẫu chung thay vì bội chung nhỏ nhất",
        "diagnoses_kcs": [
          "93a0e693-56a1-4140-bbb5-6f27cd2c155b"
        ]
      },
      {
        "pattern": "20",
        "mode": "exact",
        "diagnosis": "Chỉ tìm mẫu chung nhưng chưa quy đổi từng phân số thành phân số bằng nó",
        "diagnoses_kcs": [
          "93a0e693-56a1-4140-bbb5-6f27cd2c155b"
        ]
      }
    ],
    "flags": [
      "KC này có lỗi mislabel item trong production DB theo worklist; cần fix tag trước khi nhập item V2"
    ]
  },
  {
    "kc_id": "cdb87133-898d-431e-9155-b17dacb8d6dd",
    "question": "Tính: 1/2 + 1/3",
    "answer_type": "fraction",
    "accepted_answers": [
      "5/6"
    ],
    "tolerance": null,
    "difficulty_label": "anchor",
    "is_diagnostic_anchor": true,
    "requires_kcs": [
      "b68ce985-f530-48eb-9151-e880cf5a61fb",
      "93a0e693-56a1-4140-bbb5-6f27cd2c155b"
    ],
    "diagnoses_kcs": [
      "cdb87133-898d-431e-9155-b17dacb8d6dd",
      "93a0e693-56a1-4140-bbb5-6f27cd2c155b"
    ],
    "inference_strength": "weak",
    "academic_reviewed": false,
    "common_wrong_patterns": [
      {
        "pattern": "2/5",
        "mode": "exact",
        "diagnosis": "Cộng tử số với tử số và mẫu số với mẫu số trực tiếp",
        "diagnoses_kcs": [
          "93a0e693-56a1-4140-bbb5-6f27cd2c155b"
        ]
      },
      {
        "pattern": "1/5",
        "mode": "exact",
        "diagnosis": "Giữ tử số 1 nhưng cộng hai mẫu số, không quy đồng mẫu",
        "diagnoses_kcs": [
          "93a0e693-56a1-4140-bbb5-6f27cd2c155b"
        ]
      },
      {
        "pattern": "1/6",
        "mode": "exact",
        "diagnosis": "Nhân hai mẫu số nhưng không biến đổi tử số tương ứng",
        "diagnoses_kcs": [
          "93a0e693-56a1-4140-bbb5-6f27cd2c155b"
        ]
      }
    ],
    "flags": [
      "Playbook có phiên bản canonical của item này; bản ở đây vẫn để weak/false vì đây là AI draft"
    ]
  },
  {
    "kc_id": "1e15deb5-5b47-4a71-a5c3-a58858f93fd8",
    "question": "Phân số nghịch đảo của 4/9 là gì?",
    "answer_type": "fraction",
    "accepted_answers": [
      "9/4"
    ],
    "tolerance": null,
    "difficulty_label": "anchor",
    "is_diagnostic_anchor": true,
    "requires_kcs": [
      "b68ce985-f530-48eb-9151-e880cf5a61fb"
    ],
    "diagnoses_kcs": [
      "1e15deb5-5b47-4a71-a5c3-a58858f93fd8"
    ],
    "inference_strength": "weak",
    "academic_reviewed": false,
    "common_wrong_patterns": [
      {
        "pattern": "-4/9",
        "mode": "exact",
        "diagnosis": "Nhầm phân số nghịch đảo với số đối của phân số",
        "diagnoses_kcs": [
          "1e15deb5-5b47-4a71-a5c3-a58858f93fd8"
        ]
      },
      {
        "pattern": "4/9",
        "mode": "exact",
        "diagnosis": "Không đảo tử và mẫu khi tìm phân số nghịch đảo",
        "diagnoses_kcs": [
          "1e15deb5-5b47-4a71-a5c3-a58858f93fd8"
        ]
      },
      {
        "pattern": "-9/4",
        "mode": "exact",
        "diagnosis": "Đảo đúng tử và mẫu nhưng thêm dấu âm không có cơ sở",
        "diagnoses_kcs": [
          "1e15deb5-5b47-4a71-a5c3-a58858f93fd8"
        ]
      }
    ],
    "flags": [
      "Item này được thêm để tách riêng prerequisite 'phân số nghịch đảo' trước item bridge chia phân số"
    ]
  },
  {
    "kc_id": "d0d94d7e-8b74-4648-a31e-a722b86957d3",
    "question": "Tính: 2/3 ÷ 4/9",
    "answer_type": "fraction",
    "accepted_answers": [
      "3/2"
    ],
    "tolerance": null,
    "difficulty_label": "medium",
    "is_diagnostic_anchor": false,
    "requires_kcs": [
      "b68ce985-f530-48eb-9151-e880cf5a61fb",
      "1e15deb5-5b47-4a71-a5c3-a58858f93fd8",
      "6c18010c-1818-45cb-9c06-7c4adde88e07"
    ],
    "diagnoses_kcs": [
      "d0d94d7e-8b74-4648-a31e-a722b86957d3"
    ],
    "inference_strength": "weak",
    "academic_reviewed": false,
    "common_wrong_patterns": [
      {
        "pattern": "8/27",
        "mode": "exact",
        "diagnosis": "Nhân trực tiếp hai phân số thay vì nhân với phân số nghịch đảo của số chia",
        "diagnoses_kcs": [
          "d0d94d7e-8b74-4648-a31e-a722b86957d3",
          "1e15deb5-5b47-4a71-a5c3-a58858f93fd8"
        ]
      },
      {
        "pattern": "2/3",
        "mode": "exact",
        "diagnosis": "Đảo nhầm phân số bị chia hoặc xử lý phép chia như không làm thay đổi phân số đầu",
        "diagnoses_kcs": [
          "d0d94d7e-8b74-4648-a31e-a722b86957d3"
        ]
      },
      {
        "pattern": "27/8",
        "mode": "exact",
        "diagnosis": "Đảo cả hai phân số trước khi nhân",
        "diagnoses_kcs": [
          "d0d94d7e-8b74-4648-a31e-a722b86957d3",
          "1e15deb5-5b47-4a71-a5c3-a58858f93fd8"
        ]
      },
      {
        "pattern": "18/12",
        "mode": "exact",
        "diagnosis": "Thực hiện đúng phép chia nhưng chưa rút gọn kết quả",
        "diagnoses_kcs": [
          "959461db-e6ce-44b6-8c5f-25c65ac467e8"
        ]
      }
    ],
    "flags": [
      "Bridge item: nếu học sinh sai, không nên kết luận mạnh gap ở riêng chia phân số vì item còn cần phân số nghịch đảo và nhân phân số"
    ]
  }
]
```

---

# 2. Decimals, Percent, Ratio — 5 Items + 1 Gap

```json
[
  {
    "kc_id": "b40bd888-5268-476f-bdc6-a6116fef1b16",
    "question": "Viết phân số thập phân -2021/100 dưới dạng số thập phân.",
    "answer_type": "decimal",
    "accepted_answers": [
      "-20,21",
      "-20.21"
    ],
    "tolerance": null,
    "difficulty_label": "anchor",
    "is_diagnostic_anchor": true,
    "requires_kcs": [
      "b68ce985-f530-48eb-9151-e880cf5a61fb"
    ],
    "diagnoses_kcs": [
      "b40bd888-5268-476f-bdc6-a6116fef1b16"
    ],
    "inference_strength": "weak",
    "academic_reviewed": false,
    "common_wrong_patterns": [
      {
        "pattern": "20,21",
        "mode": "exact",
        "diagnosis": "Viết đúng phần thập phân nhưng bỏ mất dấu âm",
        "diagnoses_kcs": [
          "b40bd888-5268-476f-bdc6-a6116fef1b16"
        ]
      },
      {
        "pattern": "-202,1",
        "mode": "exact",
        "diagnosis": "Dịch dấu phẩy sai một chữ số khi mẫu là 100",
        "diagnoses_kcs": [
          "b40bd888-5268-476f-bdc6-a6116fef1b16"
        ]
      },
      {
        "pattern": "-2,021",
        "mode": "exact",
        "diagnosis": "Dịch dấu phẩy sai ba chữ số thay vì hai chữ số",
        "diagnoses_kcs": [
          "b40bd888-5268-476f-bdc6-a6116fef1b16"
        ]
      },
      {
        "pattern": "-2021",
        "mode": "exact",
        "diagnosis": "Không chuyển phân số thập phân sang số thập phân",
        "diagnoses_kcs": [
          "b40bd888-5268-476f-bdc6-a6116fef1b16"
        ]
      }
    ],
    "flags": [
      "Nếu backend chỉ nhận dấu chấm thập phân, cần normalize dấu phẩy trước khi chấm"
    ]
  },
  {
    "kc_id": "cabfac64-e7dd-4074-99fa-aa240ffa4a80",
    "question": "Cho x = -4,5 và y = -2,1. Tính x · y.",
    "answer_type": "decimal",
    "accepted_answers": [
      "9,45",
      "9.45"
    ],
    "tolerance": null,
    "difficulty_label": "anchor",
    "is_diagnostic_anchor": true,
    "requires_kcs": [
      "b40bd888-5268-476f-bdc6-a6116fef1b16"
    ],
    "diagnoses_kcs": [
      "cabfac64-e7dd-4074-99fa-aa240ffa4a80"
    ],
    "inference_strength": "weak",
    "academic_reviewed": false,
    "common_wrong_patterns": [
      {
        "pattern": "-9,45",
        "mode": "exact",
        "diagnosis": "Nhân hai số thập phân âm nhưng kết luận sai dấu của tích",
        "diagnoses_kcs": [
          "cabfac64-e7dd-4074-99fa-aa240ffa4a80"
        ]
      },
      {
        "pattern": "-9.45",
        "mode": "exact",
        "diagnosis": "Nhân hai số thập phân âm nhưng kết luận sai dấu của tích",
        "diagnoses_kcs": [
          "cabfac64-e7dd-4074-99fa-aa240ffa4a80"
        ]
      },
      {
        "pattern": "6,6",
        "mode": "exact",
        "diagnosis": "Cộng phần số dương 4,5 và 2,1 thay vì nhân",
        "diagnoses_kcs": [
          "cabfac64-e7dd-4074-99fa-aa240ffa4a80"
        ]
      },
      {
        "pattern": "-6,6",
        "mode": "exact",
        "diagnosis": "Cộng hai số rồi giữ dấu âm, nhầm phép nhân với phép cộng số thập phân âm",
        "diagnoses_kcs": [
          "cabfac64-e7dd-4074-99fa-aa240ffa4a80"
        ]
      },
      {
        "pattern": "94,5",
        "mode": "exact",
        "diagnosis": "Nhân đúng chữ số nhưng đặt sai vị trí dấu phẩy thập phân",
        "diagnoses_kcs": [
          "cabfac64-e7dd-4074-99fa-aa240ffa4a80"
        ]
      }
    ],
    "flags": [
      "Item cũng phụ thuộc vào kỹ năng nhân số thập phân dương; nếu graph có KC riêng cho thao tác nhân thập phân không dấu, cần thêm vào requires_kcs"
    ]
  },
  {
    "kc_id": "5d32c8a0-841b-47ef-b75e-9cc64f527aaa",
    "question": "Khối lượng vật A là 2 kg, vật B là 800 g. Viết tỉ số khối lượng của A so với B dưới dạng phân số tối giản.",
    "answer_type": "fraction",
    "accepted_answers": [
      "5/2"
    ],
    "tolerance": null,
    "difficulty_label": "medium",
    "is_diagnostic_anchor": true,
    "requires_kcs": [
      "959461db-e6ce-44b6-8c5f-25c65ac467e8"
    ],
    "diagnoses_kcs": [
      "5d32c8a0-841b-47ef-b75e-9cc64f527aaa"
    ],
    "inference_strength": "weak",
    "academic_reviewed": false,
    "common_wrong_patterns": [
      {
        "pattern": "1/400",
        "mode": "exact",
        "diagnosis": "Không quy đổi kg và g về cùng đơn vị trước khi lập tỉ số",
        "diagnoses_kcs": [
          "5d32c8a0-841b-47ef-b75e-9cc64f527aaa"
        ]
      },
      {
        "pattern": "2/800",
        "mode": "exact",
        "diagnosis": "Lập tỉ số theo số liệu ban đầu nhưng không quy đổi đơn vị và không rút gọn",
        "diagnoses_kcs": [
          "5d32c8a0-841b-47ef-b75e-9cc64f527aaa"
        ]
      },
      {
        "pattern": "2/5",
        "mode": "exact",
        "diagnosis": "Đảo thứ tự tỉ số, viết B so với A thay vì A so với B",
        "diagnoses_kcs": [
          "5d32c8a0-841b-47ef-b75e-9cc64f527aaa"
        ]
      },
      {
        "pattern": "2000/800",
        "mode": "exact",
        "diagnosis": "Đã quy đổi đơn vị đúng nhưng chưa rút gọn phân số",
        "diagnoses_kcs": [
          "959461db-e6ce-44b6-8c5f-25c65ac467e8",
          "5d32c8a0-841b-47ef-b75e-9cc64f527aaa"
        ]
      }
    ],
    "flags": [
      "Item này dùng lại đúng role ratio interpretation đã có trong playbook; nếu graph có KC riêng về đổi đơn vị kg-g, cần thêm vào requires_kcs"
    ]
  },
  {
    "kc_id": "9e9c5789-2dce-4f16-a695-632cb9301923",
    "question": "Tính tổng của 1/4 của 80 và 30% của 50.",
    "answer_type": "integer",
    "accepted_answers": [
      "35"
    ],
    "tolerance": null,
    "difficulty_label": "medium",
    "is_diagnostic_anchor": false,
    "requires_kcs": [
      "9b541386-16c6-4ee5-9dc0-c6eb76f0e390"
    ],
    "diagnoses_kcs": [
      "9b541386-16c6-4ee5-9dc0-c6eb76f0e390",
      "9e9c5789-2dce-4f16-a695-632cb9301923"
    ],
    "inference_strength": "weak",
    "academic_reviewed": false,
    "common_wrong_patterns": [
      {
        "pattern": "20",
        "mode": "exact",
        "diagnosis": "Chỉ tính 1/4 của 80, bỏ qua phần 30% của 50",
        "diagnoses_kcs": [
          "9b541386-16c6-4ee5-9dc0-c6eb76f0e390"
        ]
      },
      {
        "pattern": "15",
        "mode": "exact",
        "diagnosis": "Chỉ tính 30% của 50, bỏ qua phần 1/4 của 80",
        "diagnoses_kcs": [
          "9e9c5789-2dce-4f16-a695-632cb9301923"
        ]
      },
      {
        "pattern": "335",
        "mode": "exact",
        "diagnosis": "Tính 80 × 4 thay vì 80 × 1/4, nhưng phần 30% của 50 có thể đã đúng",
        "diagnoses_kcs": [
          "9b541386-16c6-4ee5-9dc0-c6eb76f0e390"
        ]
      },
      {
        "pattern": "1520",
        "mode": "exact",
        "diagnosis": "Tính 30% của 50 thành 30 × 50, không đổi 30% thành 30/100",
        "diagnoses_kcs": [
          "9e9c5789-2dce-4f16-a695-632cb9301923"
        ]
      }
    ],
    "flags": [
      "Bridge item: sai không nên kết luận mạnh riêng KC phần trăm hay KC giá trị phân số vì item cần cả hai kỹ năng và phép cộng đơn giản"
    ]
  },
  {
    "kc_id": "2c3fda5a-55af-42de-b11b-72617bc45836",
    "question": "Một cuốn sách được giảm giá 30 000 đồng, số tiền giảm giá này bằng 15% giá gốc. Giá gốc của cuốn sách là bao nhiêu đồng?",
    "answer_type": "integer",
    "accepted_answers": [
      "200000",
      "200 000"
    ],
    "tolerance": null,
    "difficulty_label": "anchor",
    "is_diagnostic_anchor": true,
    "requires_kcs": [
      "9e9c5789-2dce-4f16-a695-632cb9301923"
    ],
    "diagnoses_kcs": [
      "2c3fda5a-55af-42de-b11b-72617bc45836"
    ],
    "inference_strength": "weak",
    "academic_reviewed": false,
    "common_wrong_patterns": [
      {
        "pattern": "4500",
        "mode": "exact",
        "diagnosis": "Nhân 30 000 với 15% thay vì chia cho 15%",
        "diagnoses_kcs": [
          "2c3fda5a-55af-42de-b11b-72617bc45836"
        ]
      },
      {
        "pattern": "2000",
        "mode": "exact",
        "diagnosis": "Chia 30 000 cho 15, quên đổi 15% thành 15/100",
        "diagnoses_kcs": [
          "2c3fda5a-55af-42de-b11b-72617bc45836"
        ]
      },
      {
        "pattern": "30015",
        "mode": "exact",
        "diagnosis": "Cộng trực tiếp 30 000 và 15, không hiểu quan hệ phần trăm với giá gốc",
        "diagnoses_kcs": [
          "2c3fda5a-55af-42de-b11b-72617bc45836"
        ]
      },
      {
        "pattern": "34500",
        "mode": "exact",
        "diagnosis": "Tính 15% của 30 000 rồi cộng lại với 30 000, nhầm số tiền giảm là giá sau giảm",
        "diagnoses_kcs": [
          "2c3fda5a-55af-42de-b11b-72617bc45836"
        ]
      }
    ],
    "flags": [
      "Item này là dạng percent misconception; vẫn giữ weak vì học sinh có thể sai do diễn giải ngôn ngữ bài toán"
    ]
  }
]
```

## 2.1. Gap Record — Decimals, Percent, Ratio

```json
{
  "role": "Fraction-decimal-percent conversion",
  "status": "gap_need_academic_decision",
  "reason": "Worklist ghi rõ không tìm thấy KC phù hợp trong 64 KC hiện có cho chuyển đổi 3 chiều phân số - số thập phân - phần trăm. Không nên gán tạm vào KC tỉ số phần trăm hoặc số thập phân vì sẽ tạo hidden skill / wrong primary KC.",
  "suggested_next_action": "Hỏi Huy có muốn thêm KC riêng cho conversion này vào graph pilot hay bỏ role này khỏi pilot."
}
```

---

# 3. Expressions & Order of Operations — 5 Items

```json
[
  {
    "kc_id": "9c934457-4e43-4486-91da-61636059295c",
    "question": "Tính giá trị của biểu thức: M = 100 - 2 · 3² + 5",
    "answer_type": "integer",
    "accepted_answers": [
      "87"
    ],
    "tolerance": null,
    "difficulty_label": "anchor",
    "is_diagnostic_anchor": true,
    "requires_kcs": [
      "2ceee5b6-021d-46db-b5df-08030916bf4b"
    ],
    "diagnoses_kcs": [
      "9c934457-4e43-4486-91da-61636059295c"
    ],
    "inference_strength": "weak",
    "academic_reviewed": false,
    "common_wrong_patterns": [
      {
        "pattern": "69",
        "mode": "exact",
        "diagnosis": "Tính 2 · 3 trước rồi mới bình phương, không ưu tiên lũy thừa trước phép nhân",
        "diagnoses_kcs": [
          "9c934457-4e43-4486-91da-61636059295c"
        ]
      },
      {
        "pattern": "93",
        "mode": "exact",
        "diagnosis": "Hiểu 3² thành 3 · 2, chưa nắm cấu trúc lũy thừa trong biểu thức",
        "diagnoses_kcs": [
          "2ceee5b6-021d-46db-b5df-08030916bf4b",
          "9c934457-4e43-4486-91da-61636059295c"
        ]
      },
      {
        "pattern": "887",
        "mode": "exact",
        "diagnosis": "Thực hiện trừ trước rồi mới nhân, bỏ qua thứ tự ưu tiên nhân/chia trước cộng/trừ",
        "diagnoses_kcs": [
          "9c934457-4e43-4486-91da-61636059295c"
        ]
      },
      {
        "pattern": "77",
        "mode": "exact",
        "diagnosis": "Tính đúng lũy thừa và nhân nhưng xử lý sai phép cộng/trừ cuối cùng",
        "diagnoses_kcs": [
          "9c934457-4e43-4486-91da-61636059295c"
        ]
      }
    ],
    "flags": [
      "Item này phục vụ 2 role: order of operations và expression evaluation; requires_kcs có cấu trúc lũy thừa để tránh hidden skill"
    ]
  },
  {
    "kc_id": "a75e022e-e78b-4020-a20b-45f3b0d995dd",
    "question": "Tính giá trị của biểu thức: A = 10 + {36 ÷ [3 · (8 - 5)]}",
    "answer_type": "integer",
    "accepted_answers": [
      "14"
    ],
    "tolerance": null,
    "difficulty_label": "anchor",
    "is_diagnostic_anchor": true,
    "requires_kcs": [
      "9c934457-4e43-4486-91da-61636059295c"
    ],
    "diagnoses_kcs": [
      "a75e022e-e78b-4020-a20b-45f3b0d995dd"
    ],
    "inference_strength": "weak",
    "academic_reviewed": false,
    "common_wrong_patterns": [
      {
        "pattern": "46",
        "mode": "exact",
        "diagnosis": "Có xử lý ngoặc tròn trước nhưng bỏ qua cấu trúc ngoặc vuông, thực hiện 36 ÷ 3 · 3 từ trái sang phải",
        "diagnoses_kcs": [
          "a75e022e-e78b-4020-a20b-45f3b0d995dd"
        ]
      },
      {
        "pattern": "22",
        "mode": "exact",
        "diagnosis": "Nhân 3 với 8 trước rồi mới trừ 5, không xử lý ngoặc tròn (8 - 5) trước",
        "diagnoses_kcs": [
          "a75e022e-e78b-4020-a20b-45f3b0d995dd"
        ]
      },
      {
        "pattern": "2",
        "mode": "exact",
        "diagnosis": "Chỉ tính phần trong ngoặc nhọn 36 ÷ [3 · (8 - 5)] nhưng bỏ quên số hạng 10 bên ngoài",
        "diagnoses_kcs": [
          "a75e022e-e78b-4020-a20b-45f3b0d995dd"
        ]
      },
      {
        "pattern": "82",
        "mode": "exact",
        "diagnosis": "Thực hiện từ trái sang phải theo thứ tự xuất hiện, bỏ qua cấu trúc ngoặc lồng",
        "diagnoses_kcs": [
          "a75e022e-e78b-4020-a20b-45f3b0d995dd"
        ]
      }
    ],
    "flags": [
      "Item cố tình dùng số nhỏ để tín hiệu chính là thứ tự xử lý ngoặc, không phải tính toán nặng"
    ]
  },
  {
    "kc_id": "095f17d0-9860-4c78-9ad7-d93b1702af55",
    "question": "Viết kết quả dưới dạng một lũy thừa: 5⁴ · 5",
    "answer_type": "short_text",
    "accepted_answers": [
      "5⁵",
      "5^5",
      "5 mũ 5"
    ],
    "tolerance": null,
    "difficulty_label": "anchor",
    "is_diagnostic_anchor": true,
    "requires_kcs": [
      "2ceee5b6-021d-46db-b5df-08030916bf4b"
    ],
    "diagnoses_kcs": [
      "095f17d0-9860-4c78-9ad7-d93b1702af55"
    ],
    "inference_strength": "weak",
    "academic_reviewed": false,
    "common_wrong_patterns": [
      {
        "pattern": "5⁴",
        "mode": "exact",
        "diagnosis": "Giữ nguyên số mũ của thừa số thứ nhất, bỏ qua thừa số 5 = 5¹",
        "diagnoses_kcs": [
          "095f17d0-9860-4c78-9ad7-d93b1702af55"
        ]
      },
      {
        "pattern": "25⁴",
        "mode": "exact",
        "diagnosis": "Nhân cơ số 5 với 5 thay vì giữ nguyên cơ số và cộng số mũ",
        "diagnoses_kcs": [
          "095f17d0-9860-4c78-9ad7-d93b1702af55"
        ]
      },
      {
        "pattern": "5⁰",
        "mode": "exact",
        "diagnosis": "Nhầm quy tắc nhân lũy thừa cùng cơ số với trừ số mũ",
        "diagnoses_kcs": [
          "095f17d0-9860-4c78-9ad7-d93b1702af55"
        ]
      },
      {
        "pattern": "5^4",
        "mode": "exact",
        "diagnosis": "Giữ nguyên số mũ của thừa số thứ nhất, bỏ qua thừa số 5 = 5¹",
        "diagnoses_kcs": [
          "095f17d0-9860-4c78-9ad7-d93b1702af55"
        ]
      },
      {
        "pattern": "25^4",
        "mode": "exact",
        "diagnosis": "Nhân cơ số 5 với 5 thay vì giữ nguyên cơ số và cộng số mũ",
        "diagnoses_kcs": [
          "095f17d0-9860-4c78-9ad7-d93b1702af55"
        ]
      }
    ],
    "flags": [
      "answer_type short_text vì schema chưa có expression/power; backend nên normalize ký hiệu 5⁵ và 5^5"
    ]
  },
  {
    "kc_id": "cb9cba24-5074-4b1c-8fb6-84ab98c03a4e",
    "question": "Viết kết quả dưới dạng một lũy thừa: 8⁶ : 8²",
    "answer_type": "short_text",
    "accepted_answers": [
      "8⁴",
      "8^4",
      "8 mũ 4"
    ],
    "tolerance": null,
    "difficulty_label": "anchor",
    "is_diagnostic_anchor": true,
    "requires_kcs": [
      "2ceee5b6-021d-46db-b5df-08030916bf4b"
    ],
    "diagnoses_kcs": [
      "cb9cba24-5074-4b1c-8fb6-84ab98c03a4e"
    ],
    "inference_strength": "weak",
    "academic_reviewed": false,
    "common_wrong_patterns": [
      {
        "pattern": "8⁸",
        "mode": "exact",
        "diagnosis": "Nhầm quy tắc chia lũy thừa cùng cơ số với cộng số mũ",
        "diagnoses_kcs": [
          "cb9cba24-5074-4b1c-8fb6-84ab98c03a4e"
        ]
      },
      {
        "pattern": "1⁴",
        "mode": "exact",
        "diagnosis": "Chia cơ số 8 cho 8 thành 1 rồi giữ hiệu số mũ, không giữ nguyên cơ số",
        "diagnoses_kcs": [
          "cb9cba24-5074-4b1c-8fb6-84ab98c03a4e"
        ]
      },
      {
        "pattern": "1⁸",
        "mode": "exact",
        "diagnosis": "Vừa chia cơ số thành 1 vừa cộng số mũ, sai cả cơ số và quy tắc số mũ",
        "diagnoses_kcs": [
          "cb9cba24-5074-4b1c-8fb6-84ab98c03a4e"
        ]
      },
      {
        "pattern": "8^8",
        "mode": "exact",
        "diagnosis": "Nhầm quy tắc chia lũy thừa cùng cơ số với cộng số mũ",
        "diagnoses_kcs": [
          "cb9cba24-5074-4b1c-8fb6-84ab98c03a4e"
        ]
      },
      {
        "pattern": "1^4",
        "mode": "exact",
        "diagnosis": "Chia cơ số 8 cho 8 thành 1 rồi giữ hiệu số mũ, không giữ nguyên cơ số",
        "diagnoses_kcs": [
          "cb9cba24-5074-4b1c-8fb6-84ab98c03a4e"
        ]
      }
    ],
    "flags": [
      "answer_type short_text vì schema chưa có expression/power; backend nên normalize ký hiệu 8⁴ và 8^4"
    ]
  },
  {
    "kc_id": "7c147ca4-23b5-4563-be98-cd0b07af6f6e",
    "question": "Bỏ dấu ngoặc trong biểu thức M = 12 + (8 - 5 + 3). Viết biểu thức sau khi bỏ ngoặc, chưa cần tính giá trị.",
    "answer_type": "short_text",
    "accepted_answers": [
      "M = 12 + 8 - 5 + 3",
      "12 + 8 - 5 + 3",
      "12+8-5+3"
    ],
    "tolerance": null,
    "difficulty_label": "anchor",
    "is_diagnostic_anchor": true,
    "requires_kcs": [],
    "diagnoses_kcs": [
      "7c147ca4-23b5-4563-be98-cd0b07af6f6e"
    ],
    "inference_strength": "weak",
    "academic_reviewed": false,
    "common_wrong_patterns": [
      {
        "pattern": "12 - 8 + 5 - 3",
        "mode": "exact",
        "diagnosis": "Đổi dấu tất cả số hạng trong ngoặc dù trước ngoặc là dấu cộng",
        "diagnoses_kcs": [
          "7c147ca4-23b5-4563-be98-cd0b07af6f6e"
        ]
      },
      {
        "pattern": "12+8+5+3",
        "mode": "exact",
        "diagnosis": "Bỏ dấu trừ trước 5, tưởng bỏ ngoặc là biến mọi dấu trong ngoặc thành dấu cộng",
        "diagnoses_kcs": [
          "7c147ca4-23b5-4563-be98-cd0b07af6f6e"
        ]
      },
      {
        "pattern": "12 - 8 - 5 - 3",
        "mode": "exact",
        "diagnosis": "Đổi sai dấu của số hạng đầu và đồng thời làm mất dấu cộng trước 3",
        "diagnoses_kcs": [
          "7c147ca4-23b5-4563-be98-cd0b07af6f6e"
        ]
      },
      {
        "pattern": "12 + (8 - 5 + 3)",
        "mode": "exact",
        "diagnosis": "Không thực hiện thao tác bỏ dấu ngoặc",
        "diagnoses_kcs": [
          "7c147ca4-23b5-4563-be98-cd0b07af6f6e"
        ]
      }
    ],
    "flags": [
      "answer_type short_text vì schema chưa có expression; backend nên normalize khoảng trắng và tiền tố 'M =' trước khi chấm"
    ]
  }
]
```

---

# 4. Integers & Order — 4 Items

```json
[
  {
    "kc_id": "57767f23-fa58-4d24-a2c3-e2bc436786da",
    "question": "Sắp xếp các số -5, 3, -8, 0 theo thứ tự tăng dần. Viết theo dạng: số thứ nhất < số thứ hai < số thứ ba < số thứ tư.",
    "answer_type": "short_text",
    "accepted_answers": [
      "-8 < -5 < 0 < 3",
      "-8<-5<0<3",
      "-8, -5, 0, 3",
      "-8;-5;0;3"
    ],
    "tolerance": null,
    "difficulty_label": "anchor",
    "is_diagnostic_anchor": true,
    "requires_kcs": [
      "66e748f8-6756-4f7a-8232-b6a4b7d7661f"
    ],
    "diagnoses_kcs": [
      "57767f23-fa58-4d24-a2c3-e2bc436786da"
    ],
    "inference_strength": "weak",
    "academic_reviewed": false,
    "common_wrong_patterns": [
      {
        "pattern": "-5 < -8 < 0 < 3",
        "mode": "exact",
        "diagnosis": "So sánh số âm theo phần số tự nhiên, tưởng -5 nhỏ hơn -8 vì 5 < 8",
        "diagnoses_kcs": [
          "57767f23-fa58-4d24-a2c3-e2bc436786da"
        ]
      },
      {
        "pattern": "0 < 3 < -5 < -8",
        "mode": "exact",
        "diagnosis": "Đặt số không âm trước số âm, chưa hiểu số âm nhỏ hơn 0",
        "diagnoses_kcs": [
          "57767f23-fa58-4d24-a2c3-e2bc436786da"
        ]
      },
      {
        "pattern": "3 < 0 < -5 < -8",
        "mode": "exact",
        "diagnosis": "Sắp xếp theo thứ tự giảm dần thay vì tăng dần",
        "diagnoses_kcs": [
          "57767f23-fa58-4d24-a2c3-e2bc436786da"
        ]
      },
      {
        "pattern": "-8 < 0 < -5 < 3",
        "mode": "exact",
        "diagnosis": "Nhận ra -8 là số nhỏ nhưng đặt 0 sai vị trí giữa hai số âm",
        "diagnoses_kcs": [
          "57767f23-fa58-4d24-a2c3-e2bc436786da"
        ]
      }
    ],
    "flags": [
      "KC này không có item V1 nền dùng được vì item cũ bị cắt cụt option; backend cần normalize khoảng trắng, dấu phẩy, dấu chấm phẩy và ký hiệu < khi chấm short_text"
    ]
  },
  {
    "kc_id": "66e748f8-6756-4f7a-8232-b6a4b7d7661f",
    "question": "Trên trục số nằm ngang, điểm A cách gốc O 5 đơn vị về bên trái. A biểu diễn số nguyên nào?",
    "answer_type": "integer",
    "accepted_answers": [
      "-5"
    ],
    "tolerance": null,
    "difficulty_label": "anchor",
    "is_diagnostic_anchor": true,
    "requires_kcs": [],
    "diagnoses_kcs": [
      "66e748f8-6756-4f7a-8232-b6a4b7d7661f"
    ],
    "inference_strength": "weak",
    "academic_reviewed": false,
    "common_wrong_patterns": [
      {
        "pattern": "5",
        "mode": "exact",
        "diagnosis": "Nhận ra khoảng cách là 5 nhưng quên bên trái gốc O biểu diễn số âm",
        "diagnoses_kcs": [
          "66e748f8-6756-4f7a-8232-b6a4b7d7661f"
        ]
      },
      {
        "pattern": "0",
        "mode": "exact",
        "diagnosis": "Nhầm điểm A với gốc O hoặc không dùng thông tin cách gốc 5 đơn vị",
        "diagnoses_kcs": [
          "66e748f8-6756-4f7a-8232-b6a4b7d7661f"
        ]
      },
      {
        "pattern": "-4",
        "mode": "exact",
        "diagnosis": "Lỗi đếm khoảng cách trên trục số, lệch 1 đơn vị",
        "diagnoses_kcs": [
          "66e748f8-6756-4f7a-8232-b6a4b7d7661f"
        ]
      },
      {
        "pattern": "-6",
        "mode": "exact",
        "diagnosis": "Lỗi đếm khoảng cách trên trục số, lệch 1 đơn vị",
        "diagnoses_kcs": [
          "66e748f8-6756-4f7a-8232-b6a4b7d7661f"
        ]
      }
    ],
    "flags": [
      "Item text-based, không yêu cầu hình vẽ; nếu academic muốn loại bỏ mọi yếu tố trục số khỏi non-visual pilot thì cần thay bằng tình huống nhiệt độ/độ cao"
    ]
  },
  {
    "kc_id": "b2dfdb0c-b3ef-47d6-bb61-a76999c50cef",
    "question": "Số đối của -12 là số nào?",
    "answer_type": "integer",
    "accepted_answers": [
      "12",
      "+12"
    ],
    "tolerance": null,
    "difficulty_label": "anchor",
    "is_diagnostic_anchor": true,
    "requires_kcs": [
      "66e748f8-6756-4f7a-8232-b6a4b7d7661f"
    ],
    "diagnoses_kcs": [
      "b2dfdb0c-b3ef-47d6-bb61-a76999c50cef"
    ],
    "inference_strength": "weak",
    "academic_reviewed": false,
    "common_wrong_patterns": [
      {
        "pattern": "-12",
        "mode": "exact",
        "diagnosis": "Không đổi dấu khi tìm số đối",
        "diagnoses_kcs": [
          "b2dfdb0c-b3ef-47d6-bb61-a76999c50cef"
        ]
      },
      {
        "pattern": "0",
        "mode": "exact",
        "diagnosis": "Tưởng số đối của một số là số làm tổng bằng 0 nhưng trả lời luôn 0 thay vì số còn lại",
        "diagnoses_kcs": [
          "b2dfdb0c-b3ef-47d6-bb61-a76999c50cef"
        ]
      },
      {
        "pattern": "1/12",
        "mode": "exact",
        "diagnosis": "Nhầm số đối với số nghịch đảo",
        "diagnoses_kcs": [
          "b2dfdb0c-b3ef-47d6-bb61-a76999c50cef"
        ]
      },
      {
        "pattern": "-1/12",
        "mode": "exact",
        "diagnosis": "Nhầm số đối với số nghịch đảo và giữ dấu âm",
        "diagnoses_kcs": [
          "b2dfdb0c-b3ef-47d6-bb61-a76999c50cef"
        ]
      }
    ],
    "flags": [
      "A→B-dễ: chuyển từ MCQ cũ sang open-ended trực tiếp; vẫn giữ weak vì AI draft chưa academic reviewed"
    ]
  },
  {
    "kc_id": "c333baa7-07c9-435d-8b03-a664244d0f21",
    "question": "Tính: (-15) + 9",
    "answer_type": "integer",
    "accepted_answers": [
      "-6"
    ],
    "tolerance": null,
    "difficulty_label": "medium",
    "is_diagnostic_anchor": true,
    "requires_kcs": [
      "66e748f8-6756-4f7a-8232-b6a4b7d7661f"
    ],
    "diagnoses_kcs": [
      "c333baa7-07c9-435d-8b03-a664244d0f21"
    ],
    "inference_strength": "weak",
    "academic_reviewed": false,
    "common_wrong_patterns": [
      {
        "pattern": "24",
        "mode": "exact",
        "diagnosis": "Lấy giá trị tuyệt đối của hai số rồi cộng, bỏ qua việc hai số khác dấu cần lấy hiệu",
        "diagnoses_kcs": [
          "c333baa7-07c9-435d-8b03-a664244d0f21"
        ]
      },
      {
        "pattern": "6",
        "mode": "exact",
        "diagnosis": "Lấy hiệu đúng nhưng quên dấu của số có giá trị tuyệt đối lớn hơn",
        "diagnoses_kcs": [
          "c333baa7-07c9-435d-8b03-a664244d0f21"
        ]
      },
      {
        "pattern": "-24",
        "mode": "exact",
        "diagnosis": "Cộng hai giá trị tuyệt đối rồi lấy dấu âm, nhầm với quy tắc cộng hai số nguyên âm",
        "diagnoses_kcs": [
          "c333baa7-07c9-435d-8b03-a664244d0f21"
        ]
      },
      {
        "pattern": "0",
        "mode": "exact",
        "diagnosis": "Tưởng hai số khác dấu luôn triệt tiêu nhau về 0",
        "diagnoses_kcs": [
          "c333baa7-07c9-435d-8b03-a664244d0f21"
        ]
      }
    ],
    "flags": [
      "Đây là sign-reasoning item đã có hướng trong playbook; không nâng strong vì sign slip phổ biến và cần repeated evidence để kết luận gap mạnh"
    ]
  }
]
```

---

# 5. Number Foundations & Divisibility — 5 Items

```json
[
  {
    "kc_id": "e354d061-199b-46b6-85c5-29d02b710520",
    "question": "Viết 3 bội đầu tiên của 6 lớn hơn 0. Viết theo dạng {số thứ nhất; số thứ hai; số thứ ba}.",
    "answer_type": "set",
    "accepted_answers": [
      "{6;12;18}",
      "{6,12,18}"
    ],
    "tolerance": null,
    "difficulty_label": "anchor",
    "is_diagnostic_anchor": true,
    "requires_kcs": [],
    "diagnoses_kcs": [
      "e354d061-199b-46b6-85c5-29d02b710520"
    ],
    "inference_strength": "weak",
    "academic_reviewed": false,
    "common_wrong_patterns": [
      {
        "pattern": "{0;6;12}",
        "mode": "exact",
        "diagnosis": "Biết 0 là bội của 6 nhưng không đọc kỹ điều kiện lớn hơn 0",
        "diagnoses_kcs": [
          "e354d061-199b-46b6-85c5-29d02b710520"
        ]
      },
      {
        "pattern": "{1;2;3}",
        "mode": "exact",
        "diagnosis": "Nhầm bội của 6 với các số tự nhiên dùng để nhân với 6",
        "diagnoses_kcs": [
          "e354d061-199b-46b6-85c5-29d02b710520"
        ]
      },
      {
        "pattern": "{1;2;3;6}",
        "mode": "exact",
        "diagnosis": "Nhầm bội của 6 với ước của 6",
        "diagnoses_kcs": [
          "e354d061-199b-46b6-85c5-29d02b710520"
        ]
      },
      {
        "pattern": "{6;10;12}",
        "mode": "exact",
        "diagnosis": "Liệt kê số chẵn gần 6 thay vì các số chia hết cho 6",
        "diagnoses_kcs": [
          "e354d061-199b-46b6-85c5-29d02b710520"
        ]
      }
    ],
    "flags": [
      "Backend nên normalize dấu phẩy/dấu chấm phẩy trong set trước khi chấm"
    ]
  },
  {
    "kc_id": "f13f2f58-b3d6-4806-9a21-2f5a59622246",
    "question": "Biết 109 = 15 × 7 + 4. Khi chia 109 cho 15, thương và số dư lần lượt là gì? Viết theo dạng {thương; số dư}.",
    "answer_type": "set",
    "accepted_answers": [
      "{7;4}",
      "{7,4}"
    ],
    "tolerance": null,
    "difficulty_label": "anchor",
    "is_diagnostic_anchor": true,
    "requires_kcs": [],
    "diagnoses_kcs": [
      "f13f2f58-b3d6-4806-9a21-2f5a59622246"
    ],
    "inference_strength": "weak",
    "academic_reviewed": false,
    "common_wrong_patterns": [
      {
        "pattern": "{15;4}",
        "mode": "exact",
        "diagnosis": "Nhầm số chia với thương trong phép chia có dư",
        "diagnoses_kcs": [
          "f13f2f58-b3d6-4806-9a21-2f5a59622246"
        ]
      },
      {
        "pattern": "{7;15}",
        "mode": "exact",
        "diagnosis": "Nhầm số chia 15 với số dư",
        "diagnoses_kcs": [
          "f13f2f58-b3d6-4806-9a21-2f5a59622246"
        ]
      },
      {
        "pattern": "{4;7}",
        "mode": "exact",
        "diagnosis": "Đảo vị trí thương và số dư",
        "diagnoses_kcs": [
          "f13f2f58-b3d6-4806-9a21-2f5a59622246"
        ]
      },
      {
        "pattern": "{7;109}",
        "mode": "exact",
        "diagnosis": "Nhầm số bị chia với số dư",
        "diagnoses_kcs": [
          "f13f2f58-b3d6-4806-9a21-2f5a59622246"
        ]
      }
    ],
    "flags": [
      "A→B-dễ: giữ nguyên cấu trúc số liệu từ item V1, đổi thành câu hỏi trực tiếp để tránh MCQ recognition"
    ]
  },
  {
    "kc_id": "60307175-3512-49e9-b35b-4cfe164ef42a",
    "question": "Tính ƯCLN(18, 24) và BCNN(18, 24). Viết theo dạng {ƯCLN; BCNN}.",
    "answer_type": "set",
    "accepted_answers": [
      "{6;72}",
      "{6,72}"
    ],
    "tolerance": null,
    "difficulty_label": "medium",
    "is_diagnostic_anchor": false,
    "requires_kcs": [
      "be2c9aad-6853-4aab-883b-0893de49b156"
    ],
    "diagnoses_kcs": [
      "be2c9aad-6853-4aab-883b-0893de49b156",
      "60307175-3512-49e9-b35b-4cfe164ef42a"
    ],
    "inference_strength": "weak",
    "academic_reviewed": false,
    "common_wrong_patterns": [
      {
        "pattern": "{6;432}",
        "mode": "exact",
        "diagnosis": "Tính đúng ƯCLN nhưng lấy BCNN bằng tích 18 × 24, quên chia cho ƯCLN",
        "diagnoses_kcs": [
          "60307175-3512-49e9-b35b-4cfe164ef42a"
        ]
      },
      {
        "pattern": "{6;24}",
        "mode": "exact",
        "diagnosis": "Tính đúng ƯCLN nhưng nhầm BCNN là số lớn hơn trong hai số",
        "diagnoses_kcs": [
          "60307175-3512-49e9-b35b-4cfe164ef42a"
        ]
      },
      {
        "pattern": "{2;72}",
        "mode": "exact",
        "diagnosis": "Tính đúng BCNN nhưng chọn sai ƯCLN, có thể nhầm ước chung bất kỳ với ƯCLN",
        "diagnoses_kcs": [
          "be2c9aad-6853-4aab-883b-0893de49b156"
        ]
      },
      {
        "pattern": "{6;42}",
        "mode": "exact",
        "diagnosis": "Tính đúng ƯCLN nhưng lấy BCNN bằng 18 + 24 thay vì bội chung nhỏ nhất",
        "diagnoses_kcs": [
          "60307175-3512-49e9-b35b-4cfe164ef42a"
        ]
      }
    ],
    "flags": [
      "Bridge item: sai không nên kết luận mạnh riêng ƯCLN hay BCNN nếu chưa xem wrong_pattern",
      "Worklist ghi có thể nâng strong nếu academic duyệt, nhưng AI draft bắt buộc giữ weak/false"
    ]
  },
  {
    "kc_id": "9e7337f2-bf2d-42ed-b07c-cdad95b0dd14",
    "question": "37 là số nguyên tố hay hợp số? Trả lời kèm lí do ngắn gọn.",
    "answer_type": "short_text",
    "accepted_answers": [
      "37 là số nguyên tố vì chỉ có hai ước là 1 và 37",
      "37 là số nguyên tố vì chỉ chia hết cho 1 và chính nó",
      "số nguyên tố vì chỉ có hai ước là 1 và 37",
      "số nguyên tố vì chỉ chia hết cho 1 và 37"
    ],
    "tolerance": null,
    "difficulty_label": "medium",
    "is_diagnostic_anchor": true,
    "requires_kcs": [
      "f13f2f58-b3d6-4806-9a21-2f5a59622246"
    ],
    "diagnoses_kcs": [
      "9e7337f2-bf2d-42ed-b07c-cdad95b0dd14"
    ],
    "inference_strength": "weak",
    "academic_reviewed": false,
    "common_wrong_patterns": [
      {
        "pattern": "hợp số",
        "mode": "contains",
        "diagnosis": "Chưa phân biệt số nguyên tố với hợp số hoặc tưởng số lớn hơn 10 thường là hợp số",
        "diagnoses_kcs": [
          "9e7337f2-bf2d-42ed-b07c-cdad95b0dd14"
        ]
      },
      {
        "pattern": "vì 37 là số lẻ",
        "mode": "contains",
        "diagnosis": "Dùng tính lẻ để kết luận số nguyên tố, thiếu kiểm tra ước khác 1 và chính nó",
        "diagnoses_kcs": [
          "9e7337f2-bf2d-42ed-b07c-cdad95b0dd14"
        ]
      },
      {
        "pattern": "vì 37 không chia hết cho 2",
        "mode": "contains",
        "diagnosis": "Chỉ kiểm tra chia hết cho 2, chưa hiểu cần loại trừ các ước khác",
        "diagnoses_kcs": [
          "9e7337f2-bf2d-42ed-b07c-cdad95b0dd14"
        ]
      },
      {
        "pattern": "37 có nhiều hơn hai ước",
        "mode": "contains",
        "diagnosis": "Kết luận sai về số ước của 37",
        "diagnoses_kcs": [
          "9e7337f2-bf2d-42ed-b07c-cdad95b0dd14"
        ]
      }
    ],
    "flags": [
      "short_text cần academic review rubric; nếu muốn auto-grade cứng hơn, nên đổi thành 2-part structured input: label = nguyên tố/hợp số + reason_code",
      "requires_kcs có divisibility test vì học sinh cần kiểm tra khả năng chia hết để giải thích"
    ]
  },
  {
    "kc_id": "be2c9aad-6853-4aab-883b-0893de49b156",
    "question": "Vì sao để tìm tất cả ước chung của 18 và 24, ta chỉ cần tìm ước của ƯCLN(18, 24) mà không cần liệt kê hết ước của từng số rồi so sánh?",
    "answer_type": "short_text",
    "accepted_answers": [
      "vì mọi ước chung đều phải là ước của ưcln",
      "vì ước chung là ước của ưcln",
      "vì mọi ước chung của 18 và 24 đều là ước của ưcln(18,24)",
      "vì ước chung là ước của số lớn nhất cùng chia hết cả hai số"
    ],
    "tolerance": null,
    "difficulty_label": "hard",
    "is_diagnostic_anchor": false,
    "requires_kcs": [
      "a44cc514-3d97-4f27-ad2f-0488badff527"
    ],
    "diagnoses_kcs": [
      "be2c9aad-6853-4aab-883b-0893de49b156"
    ],
    "inference_strength": "weak",
    "academic_reviewed": false,
    "common_wrong_patterns": [
      {
        "pattern": "vì ước chung và ưcln không liên quan",
        "mode": "contains",
        "diagnosis": "Chưa hiểu quan hệ giữa tập ước chung và tập ước của ƯCLN",
        "diagnoses_kcs": [
          "be2c9aad-6853-4aab-883b-0893de49b156"
        ]
      },
      {
        "pattern": "vì ưcln là bội chung",
        "mode": "contains",
        "diagnosis": "Nhầm ƯCLN với BCNN hoặc nhầm ước với bội",
        "diagnoses_kcs": [
          "be2c9aad-6853-4aab-883b-0893de49b156",
          "60307175-3512-49e9-b35b-4cfe164ef42a"
        ]
      },
      {
        "pattern": "vì 18 và 24 có cùng ước",
        "mode": "contains",
        "diagnosis": "Trả lời vòng vo, chưa nêu được quan hệ mọi ước chung là ước của ƯCLN",
        "diagnoses_kcs": [
          "be2c9aad-6853-4aab-883b-0893de49b156"
        ]
      }
    ],
    "flags": [
      "Transfer item từ playbook; short_text rubric cần academic duyệt kỹ trước khi dùng cho strong inference",
      "Đây không phải item tính toán thuần, nên chỉ phù hợp nếu pilot muốn đo conceptual transfer"
    ]
  }
]
```

---

# 6. Data / Statistics / Probability, Non-Visual — 3 Items + 2 Gaps

```json
[
  {
    "kc_id": "37f66bcc-182b-4f34-bd00-f2be0a91e83e",
    "question": "Trong một biểu đồ tranh, mỗi biểu tượng ʘ đại diện cho 10 học sinh và mỗi nửa biểu tượng ʘ đại diện cho 5 học sinh. Dòng \"Lớp 6A\" có 3 biểu tượng ʘ và 1 nửa biểu tượng ʘ. Lớp 6A có tất cả bao nhiêu học sinh?",
    "answer_type": "integer",
    "accepted_answers": [
      "35"
    ],
    "tolerance": null,
    "difficulty_label": "anchor",
    "is_diagnostic_anchor": true,
    "requires_kcs": [],
    "diagnoses_kcs": [
      "37f66bcc-182b-4f34-bd00-f2be0a91e83e"
    ],
    "inference_strength": "weak",
    "academic_reviewed": false,
    "common_wrong_patterns": [
      {
        "pattern": "31",
        "mode": "exact",
        "diagnosis": "Đếm 3 biểu tượng đầy đủ là 30 nhưng xem nửa biểu tượng là 1 học sinh thay vì 5 học sinh",
        "diagnoses_kcs": [
          "37f66bcc-182b-4f34-bd00-f2be0a91e83e"
        ]
      },
      {
        "pattern": "40",
        "mode": "exact",
        "diagnosis": "Xem nửa biểu tượng như một biểu tượng đầy đủ, nên tính 4 × 10",
        "diagnoses_kcs": [
          "37f66bcc-182b-4f34-bd00-f2be0a91e83e"
        ]
      },
      {
        "pattern": "30",
        "mode": "exact",
        "diagnosis": "Chỉ tính 3 biểu tượng đầy đủ, bỏ qua nửa biểu tượng",
        "diagnoses_kcs": [
          "37f66bcc-182b-4f34-bd00-f2be0a91e83e"
        ]
      },
      {
        "pattern": "15",
        "mode": "exact",
        "diagnosis": "Nhầm mỗi biểu tượng đầy đủ là 5 học sinh, hoặc dùng sai giá trị biểu tượng",
        "diagnoses_kcs": [
          "37f66bcc-182b-4f34-bd00-f2be0a91e83e"
        ]
      }
    ],
    "flags": [
      "A→B-dễ: giữ số liệu biểu đồ tranh cũ nhưng đổi thành câu hỏi open-ended trực tiếp",
      "Nếu graph có KC riêng cho phép nhân/cộng số tự nhiên, academic có thể thêm vào requires_kcs"
    ]
  },
  {
    "kc_id": "67efc576-2aee-4fb8-9620-fb56c374b796",
    "question": "Một học sinh gieo một con xúc xắc 60 lần và thấy mặt 6 chấm xuất hiện 12 lần. Tính xác suất thực nghiệm của sự kiện \"xuất hiện mặt 6 chấm\", viết dưới dạng phân số tối giản.",
    "answer_type": "fraction",
    "accepted_answers": [
      "1/5"
    ],
    "tolerance": null,
    "difficulty_label": "anchor",
    "is_diagnostic_anchor": true,
    "requires_kcs": [
      "959461db-e6ce-44b6-8c5f-25c65ac467e8"
    ],
    "diagnoses_kcs": [
      "67efc576-2aee-4fb8-9620-fb56c374b796"
    ],
    "inference_strength": "weak",
    "academic_reviewed": false,
    "common_wrong_patterns": [
      {
        "pattern": "12/48",
        "mode": "exact",
        "diagnosis": "Lấy số lần không xảy ra sự kiện làm mẫu số thay vì tổng số lần thực hiện thí nghiệm",
        "diagnoses_kcs": [
          "67efc576-2aee-4fb8-9620-fb56c374b796"
        ]
      },
      {
        "pattern": "60/12",
        "mode": "exact",
        "diagnosis": "Đảo ngược tử số và mẫu số trong công thức xác suất thực nghiệm",
        "diagnoses_kcs": [
          "67efc576-2aee-4fb8-9620-fb56c374b796"
        ]
      },
      {
        "pattern": "12/60",
        "mode": "exact",
        "diagnosis": "Lập đúng tỉ số số lần xảy ra trên tổng số lần thử nhưng chưa rút gọn về phân số tối giản",
        "diagnoses_kcs": [
          "959461db-e6ce-44b6-8c5f-25c65ac467e8",
          "67efc576-2aee-4fb8-9620-fb56c374b796"
        ]
      },
      {
        "pattern": "48/60",
        "mode": "exact",
        "diagnosis": "Tính xác suất thực nghiệm của sự kiện không xuất hiện mặt 6 chấm thay vì sự kiện được hỏi",
        "diagnoses_kcs": [
          "67efc576-2aee-4fb8-9620-fb56c374b796"
        ]
      }
    ],
    "flags": [
      "Item canonical từ playbook; vẫn giữ weak/false vì đây là AI draft để academic review lại"
    ]
  },
  {
    "kc_id": "6fa1eded-67e4-4274-a8a3-2e018af090fe",
    "question": "Lan gieo một đồng xu 20 lần, mặt ngửa xuất hiện 8 lần. Minh gieo cùng loại đồng xu 50 lần, mặt ngửa xuất hiện 20 lần. Xác suất thực nghiệm xuất hiện mặt ngửa của hai bạn có bằng nhau không? Trả lời \"có\" hoặc \"không\".",
    "answer_type": "short_text",
    "accepted_answers": [
      "có",
      "co",
      "bằng nhau",
      "bang nhau",
      "="
    ],
    "tolerance": null,
    "difficulty_label": "medium",
    "is_diagnostic_anchor": false,
    "requires_kcs": [
      "67efc576-2aee-4fb8-9620-fb56c374b796",
      "959461db-e6ce-44b6-8c5f-25c65ac467e8",
      "0164cf7c-e080-4ca0-909b-e292f65af633"
    ],
    "diagnoses_kcs": [
      "6fa1eded-67e4-4274-a8a3-2e018af090fe"
    ],
    "inference_strength": "weak",
    "academic_reviewed": false,
    "common_wrong_patterns": [
      {
        "pattern": "không",
        "mode": "contains",
        "diagnosis": "So sánh số lần mặt ngửa xuất hiện trực tiếp 8 và 20, không xét tỉ số trên tổng số lần thử",
        "diagnoses_kcs": [
          "6fa1eded-67e4-4274-a8a3-2e018af090fe"
        ]
      },
      {
        "pattern": "khong",
        "mode": "contains",
        "diagnosis": "So sánh số lần thực hiện 20 và 50 trực tiếp, không xét xác suất thực nghiệm",
        "diagnoses_kcs": [
          "6fa1eded-67e4-4274-a8a3-2e018af090fe"
        ]
      },
      {
        "pattern": "8/20 khác 20/50",
        "mode": "contains",
        "diagnosis": "Lập đúng hai tỉ số nhưng chưa nhận ra hai phân số bằng nhau sau khi rút gọn",
        "diagnoses_kcs": [
          "959461db-e6ce-44b6-8c5f-25c65ac467e8",
          "0164cf7c-e080-4ca0-909b-e292f65af633",
          "6fa1eded-67e4-4274-a8a3-2e018af090fe"
        ]
      }
    ],
    "flags": [
      "Bridge item: sai có thể đến từ tính xác suất thực nghiệm, rút gọn phân số, hoặc nhận biết hai phân số bằng nhau; không dùng để kết luận mạnh riêng KC nhận xét xác suất",
      "answer_type short_text chỉ ở dạng Có/Không; backend nên normalize dấu tiếng Việt"
    ]
  }
]
```

## 6.1. Gap Records — Data / Statistics / Probability

```json
[
  {
    "role": "Compute/interpret basic statistic",
    "status": "gap_need_academic_decision",
    "reason": "Worklist ghi không tìm thấy KC phù hợp cho mean/mode/basic statistic trong 64 KC hiện có. Không nên tự gán vào DOC-VA-PHAN, LAP-BANG-THONG, hoặc TINH-XAC-SUAT vì sẽ sai primary KC và tạo hidden skill.",
    "suggested_next_action": "Hỏi Huy có muốn thêm KC riêng cho số trung bình/mốt vào graph pilot hay bỏ role này khỏi pilot."
  },
  {
    "role": "Distinguish impossible/certain/possible",
    "status": "gap_need_academic_decision",
    "reason": "Worklist ghi không có KC nào trong 64 KC test riêng phân loại sự kiện không thể/chắc chắn/có thể. Bài 43 có nhắc khả năng 0 và 1, nhưng nếu graph chưa có KC riêng thì không nên viết item và gán tạm vào TINH-XAC-SUAT.",
    "suggested_next_action": "Hỏi Huy có muốn tạo KC riêng cho phân loại sự kiện hoặc chuyển role này sang visual/probability phase sau."
  }
]
```

---

# 7. Final Academic Review Checklist

Academic reviewer should decide for each item:

- Is the primary KC correct?
- Are all hidden prerequisite KCs listed in `requires_kcs`?
- Is the item answer auto-gradable with current backend?
- Are `accepted_answers` complete enough?
- Are `common_wrong_patterns` useful and not overclaiming diagnosis?
- Should item remain `weak`, or can it be upgraded after review?
- Does the item produce clean enough evidence for adaptive assessment V2?
- Should any short_text item be redesigned into a structured input?

Recommended production import rule:

```json
{
  "inference_strength": "weak",
  "academic_reviewed": false,
  "import_status": "draft_only"
}
```

Only academic team should approve:

```json
{
  "academic_reviewed": true,
  "inference_strength": "weak | medium | strong"
}
```
