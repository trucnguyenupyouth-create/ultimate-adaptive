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