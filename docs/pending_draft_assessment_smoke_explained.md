# Pending Draft Assessment Smoke - Dien giai chi tiet

> Report nay duoc tao tu run smoke da thanh cong. Run dung math-mode, khong goi Gemini agent, nen khong co suy nghi/ly do bang ngon ngu tu nhien cua agent. Ly do dung/sai la xac suat IRT theo persona biet/khong biet KC.

## Tong quan

- active_items: 1292
- active_kcs: 220
- pending_drafts_injected: 356
- pending_draft_kcs: 69
- merged_items: 1648
- merged_kcs: 224

## Draft tags

- batch_import_20260622: 316
- batch_import_70_115_20260622: 40

## Cach doc step

- `source=active_item`: cau da approved trong item bank.
- `source=pending_draft`: cau draft duoc inject tam trong memory, khong approve DB.
- Math-mode khong chon dap an A/B/C/D; no sampling dung/sai theo IRT, `p_slip`, `p_guess`.
- Report goc chua luu question text, nen cac step duoi day chi co `item_id`. Script hien da duoc sua de lan chay DB tiep theo se luu full question/options.

## Natural Traversal Runs

### Persona: complete_beginner

- Trials: 5
- Total pending draft items used: 0
- Avg items: 19.4
- Avg KCs visited: 3.6

#### Sample Trial Steps

1. kc=0688b803-9f36-430d-9f4b-61749b2bda57 item=c6fabbb9-7818-427c-b446-d5a2971f8522 source=active_item b=0.0 anchor=True knows=False correct=False
2. kc=0688b803-9f36-430d-9f4b-61749b2bda57 item=8c936224-c569-490b-91c6-3641fc5ac966 source=active_item b=-1.0 anchor=False knows=False correct=False
3. kc=0688b803-9f36-430d-9f4b-61749b2bda57 item=c6fabbb9-7818-427c-b446-d5a2971f8522 source=active_item b=0.0 anchor=True knows=False correct=False
4. kc=b6076d9c-df71-4a84-8980-b462caca92b9 item=7118c6e8-8d01-4502-8059-1e3228ab7777 source=active_item b=0.0 anchor=True knows=False correct=False
5. kc=b6076d9c-df71-4a84-8980-b462caca92b9 item=2f7cbadb-59d7-429f-914b-328b32cd9e7f source=active_item b=0.0 anchor=True knows=False correct=False
6. kc=b6076d9c-df71-4a84-8980-b462caca92b9 item=7118c6e8-8d01-4502-8059-1e3228ab7777 source=active_item b=0.0 anchor=True knows=False correct=False
7. kc=05f26197-d571-4556-b0a4-6edbc70a1b4a item=30b7a475-3f12-4fee-8d34-8148690fec70 source=active_item b=0.0 anchor=True knows=False correct=False
8. kc=05f26197-d571-4556-b0a4-6edbc70a1b4a item=e380b9b9-6df7-404b-87b2-816f6f8d89c8 source=active_item b=0.0 anchor=True knows=False correct=False
9. kc=05f26197-d571-4556-b0a4-6edbc70a1b4a item=30b7a475-3f12-4fee-8d34-8148690fec70 source=active_item b=0.0 anchor=True knows=False correct=False
10. kc=1cacabc0-84c6-435e-aafb-62a50e4425af item=e180cf0a-e85a-43cb-91f3-4b5c3446bd76 source=active_item b=0.0 anchor=True knows=False correct=False
11. kc=1cacabc0-84c6-435e-aafb-62a50e4425af item=ff5480c1-7461-4688-b05b-6612a0983189 source=active_item b=0.0 anchor=True knows=False correct=True
12. kc=1cacabc0-84c6-435e-aafb-62a50e4425af item=e180cf0a-e85a-43cb-91f3-4b5c3446bd76 source=active_item b=0.0 anchor=True knows=False correct=False
13. kc=1cacabc0-84c6-435e-aafb-62a50e4425af item=ff5480c1-7461-4688-b05b-6612a0983189 source=active_item b=0.0 anchor=True knows=False correct=False
14. kc=1cacabc0-84c6-435e-aafb-62a50e4425af item=e180cf0a-e85a-43cb-91f3-4b5c3446bd76 source=active_item b=0.0 anchor=True knows=False correct=False

### Persona: expert

- Trials: 5
- Total pending draft items used: 0
- Avg items: 13.2
- Avg KCs visited: 4.0

#### Sample Trial Steps

1. kc=0688b803-9f36-430d-9f4b-61749b2bda57 item=c6fabbb9-7818-427c-b446-d5a2971f8522 source=active_item b=0.0 anchor=True knows=True correct=True
2. kc=0688b803-9f36-430d-9f4b-61749b2bda57 item=8c936224-c569-490b-91c6-3641fc5ac966 source=active_item b=-1.0 anchor=False knows=True correct=True
3. kc=0688b803-9f36-430d-9f4b-61749b2bda57 item=c6fabbb9-7818-427c-b446-d5a2971f8522 source=active_item b=0.0 anchor=True knows=True correct=True
4. kc=d576d596-8eee-40b7-ba22-52d3b1fe1c96 item=258bbfd0-dac9-462a-a592-034b60583a32 source=active_item b=0.0 anchor=True knows=True correct=True
5. kc=d576d596-8eee-40b7-ba22-52d3b1fe1c96 item=f933e33d-adf3-40ab-9182-5b49f2b0dae9 source=active_item b=0.0 anchor=True knows=True correct=True
6. kc=d576d596-8eee-40b7-ba22-52d3b1fe1c96 item=258bbfd0-dac9-462a-a592-034b60583a32 source=active_item b=0.0 anchor=True knows=True correct=True
7. kc=5a4bbd95-5a87-45cf-89cf-709261a4d0bb item=c8e45b61-7d8b-47d5-a400-f71ea6c406b0 source=active_item b=0.0 anchor=True knows=True correct=True
8. kc=5a4bbd95-5a87-45cf-89cf-709261a4d0bb item=6e91fe77-5e55-4f48-98de-cc99cd409029 source=active_item b=0.0 anchor=True knows=True correct=True
9. kc=5a4bbd95-5a87-45cf-89cf-709261a4d0bb item=c8e45b61-7d8b-47d5-a400-f71ea6c406b0 source=active_item b=0.0 anchor=True knows=True correct=True
10. kc=d1c11b45-de83-479d-a2c5-1fabd61231db item=9344c0e3-c126-4d9e-9678-ccdc65d523e5 source=active_item b=0.0 anchor=True knows=True correct=True
11. kc=d1c11b45-de83-479d-a2c5-1fabd61231db item=15efd01f-8792-4dcc-a8ef-560b5c9fe248 source=active_item b=0.0 anchor=True knows=True correct=True
12. kc=d1c11b45-de83-479d-a2c5-1fabd61231db item=9344c0e3-c126-4d9e-9678-ccdc65d523e5 source=active_item b=0.0 anchor=True knows=True correct=False
13. kc=d1c11b45-de83-479d-a2c5-1fabd61231db item=15efd01f-8792-4dcc-a8ef-560b5c9fe248 source=active_item b=0.0 anchor=True knows=True correct=True
14. kc=d1c11b45-de83-479d-a2c5-1fabd61231db item=9344c0e3-c126-4d9e-9678-ccdc65d523e5 source=active_item b=0.0 anchor=True knows=True correct=True
15. kc=d1c11b45-de83-479d-a2c5-1fabd61231db item=15efd01f-8792-4dcc-a8ef-560b5c9fe248 source=active_item b=0.0 anchor=True knows=True correct=True

### Persona: chapter1_only

- Trials: 5
- Total pending draft items used: 0
- Avg items: 9.8
- Avg KCs visited: 2.0

#### Sample Trial Steps

1. kc=0688b803-9f36-430d-9f4b-61749b2bda57 item=c6fabbb9-7818-427c-b446-d5a2971f8522 source=active_item b=0.0 anchor=True knows=True correct=True
2. kc=0688b803-9f36-430d-9f4b-61749b2bda57 item=8c936224-c569-490b-91c6-3641fc5ac966 source=active_item b=-1.0 anchor=False knows=True correct=True
3. kc=0688b803-9f36-430d-9f4b-61749b2bda57 item=c6fabbb9-7818-427c-b446-d5a2971f8522 source=active_item b=0.0 anchor=True knows=True correct=True
4. kc=d576d596-8eee-40b7-ba22-52d3b1fe1c96 item=258bbfd0-dac9-462a-a592-034b60583a32 source=active_item b=0.0 anchor=True knows=False correct=False
5. kc=d576d596-8eee-40b7-ba22-52d3b1fe1c96 item=f933e33d-adf3-40ab-9182-5b49f2b0dae9 source=active_item b=0.0 anchor=True knows=False correct=False
6. kc=d576d596-8eee-40b7-ba22-52d3b1fe1c96 item=258bbfd0-dac9-462a-a592-034b60583a32 source=active_item b=0.0 anchor=True knows=False correct=False

## Targeted Draft-Only KC Smoke

### G6-MAMATMATHMAT - Trừ hai phân số khác mẫu

- ok: True
- first_item_source: pending_draft
- kc_result: pass

1. item=draft:cd8df22c-4657-49c6-859c-ab9f0b2d7245 source=pending_draft b=0.0 anchor=True
2. item=draft:6db77809-5867-4901-8786-1b1a16b64572 source=pending_draft b=0.0 anchor=True
3. item=draft:cd8df22c-4657-49c6-859c-ab9f0b2d7245 source=pending_draft b=0.0 anchor=True

### G6-MATH-CHON-PHUONG-PHAP - Chọn phương pháp thu thập dữ liệu 

- ok: True
- first_item_source: pending_draft
- kc_result: pass

1. item=draft:bc2a94c4-2a43-4c32-8252-a16f4a0d08a7 source=pending_draft b=0.0 anchor=True
2. item=draft:387c3ea9-b916-4d28-89ac-dff95e7f8397 source=pending_draft b=0.0 anchor=True
3. item=draft:bc2a94c4-2a43-4c32-8252-a16f4a0d08a7 source=pending_draft b=0.0 anchor=True

### G6-MATH-SO-SANH-HAI-3 - So sánh hai góc 

- ok: True
- first_item_source: pending_draft
- kc_result: pass

1. item=draft:d92160b4-b60c-44a2-bb6f-d97e00fb5b00 source=pending_draft b=0.0 anchor=True
2. item=draft:6e5c8d3c-c406-4123-bba0-58b6af2c54e7 source=pending_draft b=0.0 anchor=True
3. item=draft:d92160b4-b60c-44a2-bb6f-d97e00fb5b00 source=pending_draft b=0.0 anchor=True

### G9-MATH-TIM-MOT-SO - Tìm một số biết giá trị phân số của nó

- ok: True
- first_item_source: pending_draft
- kc_result: pass

1. item=draft:983bb5a4-63e5-4fc0-ad42-a6ba168f4d62 source=pending_draft b=0.0 anchor=True
2. item=draft:5473d5b6-d32c-4560-81c0-62253fb4d8ba source=pending_draft b=0.0 anchor=True
3. item=draft:983bb5a4-63e5-4fc0-ad42-a6ba168f4d62 source=pending_draft b=0.0 anchor=True
