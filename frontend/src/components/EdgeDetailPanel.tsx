"use client";

import { useState, useCallback, useEffect } from "react";
import { X, Loader2, ArrowRightLeft, Trash2, Save, History, ExternalLink, FileText, Calendar } from "lucide-react";
import { graphApi, EdgeDetail } from "@/lib/api";

interface Props {
  edgeId: string | null; // Format: "prereqId->kcId"
  onClose: () => void;
  onEdgeUpdated: () => void;
  onEdgeDeleted: () => void;
  onEdgeReversed: () => void;
  onJumpToKC: (kcId: string) => void;
}

export default function EdgeDetailPanel({
  edgeId,
  onClose,
  onEdgeUpdated,
  onEdgeDeleted,
  onEdgeReversed,
  onJumpToKC,
}: Props) {
  const [detail, setDetail] = useState<EdgeDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reversing, setReversing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  const [labelInput, setLabelInput] = useState("");
  const [confirmReverse, setConfirmReverse] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadDetail = useCallback(async (idStr: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [prereqId, kcId] = idStr.split("->");
      if (!prereqId || !kcId) return;
      const data = await graphApi.getEdge(kcId, prereqId);
      setDetail(data);
      setLabelInput(data.label ?? "");
    } catch {
      setErrorMsg("Không thể tải chi tiết mối quan hệ.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (edgeId) {
      setDetail(null);
      setConfirmReverse(false);
      setConfirmDelete(false);
      setErrorMsg(null);
      loadDetail(edgeId);
    }
  }, [edgeId, loadDetail]);

  if (!edgeId) return null;

  const handleSaveLabel = async () => {
    if (!detail) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await graphApi.updateEdge(
        detail.kc_id,
        detail.prereq_id,
        labelInput.trim() || null,
        detail.weight
      );
      // Reload detail to get updated history
      await loadDetail(edgeId);
      onEdgeUpdated();
    } catch {
      setErrorMsg("Lỗi khi lưu nhãn chú thích.");
    } finally {
      setSaving(false);
    }
  };

  const handleReverse = async () => {
    if (!detail) return;
    setReversing(true);
    setErrorMsg(null);
    try {
      const res = await graphApi.reverseEdge(detail.kc_id, detail.prereq_id);
      if (!res.ok) {
        setErrorMsg("Không thể đảo chiều: tạo vòng lặp trong sơ đồ.");
        setConfirmReverse(false);
        return;
      }
      onEdgeReversed();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Lỗi khi đảo chiều liên kết.");
      setConfirmReverse(false);
    } finally {
      setReversing(false);
    }
  };

  const handleDelete = async () => {
    if (!detail) return;
    setDeleting(true);
    setErrorMsg(null);
    try {
      await graphApi.removePrerequisite(detail.kc_id, detail.prereq_id);
      onEdgeDeleted();
      onClose();
    } catch {
      setErrorMsg("Lỗi khi xoá liên kết.");
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  const formatAction = (action: string) => {
    switch (action) {
      case "add_edge":
        return "Tạo liên kết";
      case "remove_edge":
        return "Xoá liên kết";
      case "update_edge":
        return "Cập nhật nhãn";
      case "reverse_edge":
        return "Đảo chiều liên kết";
      default:
        return action;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 47,
        }}
      />

      {/* Panel container */}
      <div
        className="fade-in"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: 420,
          zIndex: 48,
          background: "rgba(22,27,34,0.97)",
          backdropFilter: "blur(16px)",
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
              Chi tiết liên kết
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              Prerequisite Relationship
            </div>
          </div>
          <button
            className="btn btn-ghost"
            onClick={onClose}
            style={{ padding: "4px 6px" }}
            title="Đóng"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          {errorMsg && (
            <div
              style={{
                background: "rgba(248,81,73,0.1)",
                border: "1px solid rgba(248,81,73,0.3)",
                color: "var(--accent-red)",
                padding: "10px 14px",
                borderRadius: 6,
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {errorMsg}
            </div>
          )}

          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", paddingTop: 40 }}>
              <Loader2 size={24} className="animate-spin" color="var(--text-muted)" />
            </div>
          ) : detail ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {/* Arrow diagram */}
              <div
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", width: "100%", justifyContent: "space-around" }}>
                  <div style={{ textAlign: "center", width: "40%" }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        fontFamily: "monospace",
                        color: "var(--accent-blue)",
                        background: "rgba(56,139,253,0.1)",
                        padding: "4px 8px",
                        borderRadius: 4,
                        display: "inline-block",
                      }}
                    >
                      {detail.source_code}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-secondary)",
                        marginTop: 4,
                        textOverflow: "ellipsis",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                      }}
                      title={detail.source_name}
                    >
                      {detail.source_name}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ fontSize: 18, color: "var(--text-muted)" }}>➔</div>
                    <span style={{ fontSize: 9, color: "var(--text-muted)", marginTop: -4 }}>Yêu cầu</span>
                  </div>

                  <div style={{ textAlign: "center", width: "40%" }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        fontFamily: "monospace",
                        color: "var(--accent-green)",
                        background: "rgba(63,185,80,0.1)",
                        padding: "4px 8px",
                        borderRadius: 4,
                        display: "inline-block",
                      }}
                    >
                      {detail.target_code}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-secondary)",
                        marginTop: 4,
                        textOverflow: "ellipsis",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                      }}
                      title={detail.target_name}
                    >
                      {detail.target_name}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    textAlign: "center",
                    borderTop: "1px solid var(--border-subtle)",
                    width: "100%",
                    paddingTop: 10,
                    marginTop: 4,
                    lineHeight: 1.4,
                  }}
                >
                  Học sinh phải nắm vững kiến thức <strong>{detail.source_code}</strong> trước khi học <strong>{detail.target_code}</strong>.
                </div>
              </div>

              {/* Quick Jump Buttons */}
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1, fontSize: 12, gap: 6, padding: "8px 12px" }}
                  onClick={() => onJumpToKC(detail.prereq_id)}
                >
                  <ExternalLink size={13} />
                  KC Nguồn
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1, fontSize: 12, gap: 6, padding: "8px 12px" }}
                  onClick={() => onJumpToKC(detail.kc_id)}
                >
                  <ExternalLink size={13} />
                  KC Đích
                </button>
              </div>

              {/* Annotation Label */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
                  Chú thích liên kết
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    className="input"
                    value={labelInput}
                    onChange={(e) => setLabelInput(e.target.value)}
                    placeholder="Ví dụ: Chỉ yêu cầu với lớp nâng cao..."
                    style={{ flex: 1, background: "rgba(0,0,0,0.2)" }}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={handleSaveLabel}
                    disabled={saving || labelInput.trim() === (detail.label ?? "")}
                    style={{ padding: "0 12px", gap: 4 }}
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Lưu
                  </button>
                </div>
              </div>

              {/* Metadata Info */}
              <div
                style={{
                  background: "rgba(255,255,255,0.01)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 6,
                  padding: "12px",
                  fontSize: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Thời gian tạo:</span>
                  <span style={{ color: "var(--text-secondary)" }}>
                    {detail.created_at ? formatDate(detail.created_at) : "N/A"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Người tạo:</span>
                  <span style={{ color: "var(--text-secondary)" }}>
                    {detail.created_by_name ?? "Hệ thống"}
                  </span>
                </div>
              </div>

              {/* History Log */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
                  <History size={14} />
                  Lịch sử chỉnh sửa (Tối đa 5)
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    maxHeight: 200,
                    overflowY: "auto",
                  }}
                >
                  {detail.history && detail.history.length > 0 ? (
                    detail.history.map((h) => (
                      <div
                        key={h.id}
                        style={{
                          background: "rgba(0,0,0,0.15)",
                          borderLeft: "2px solid var(--border)",
                          padding: "8px 10px",
                          borderRadius: "0 4px 4px 0",
                          fontSize: 11,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", marginBottom: 4 }}>
                          <span style={{ fontWeight: 600 }}>{formatAction(h.action)}</span>
                          <span>{formatDate(h.created_at)}</span>
                        </div>
                        <div style={{ color: "var(--text-secondary)" }}>
                          Bởi: <strong>{h.performed_by_name}</strong>
                        </div>
                        {h.payload && h.payload.label !== undefined && (
                          <div style={{ color: "var(--text-muted)", fontSize: 10, marginTop: 2, fontStyle: "italic" }}>
                            Nhãn: &quot;{h.payload.label ?? "Không có"}&quot;
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "12px 0" }}>
                      Chưa có lịch sử ghi nhận
                    </div>
                  )}
                </div>
              </div>

              {/* Danger Zone */}
              <div
                style={{
                  borderTop: "1px solid var(--border)",
                  paddingTop: 20,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  marginTop: 8,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-red)" }}>
                  Vùng nguy hiểm
                </div>

                {/* Reverse edge direction */}
                {!confirmReverse ? (
                  <button
                    className="btn btn-secondary"
                    style={{ gap: 6, justifyContent: "center" }}
                    onClick={() => {
                      setConfirmReverse(true);
                      setConfirmDelete(false);
                    }}
                  >
                    <ArrowRightLeft size={14} />
                    Đảo chiều liên kết
                  </button>
                ) : (
                  <div
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      padding: "12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <div style={{ fontSize: 12, color: "var(--text-primary)" }}>
                      Xác nhận đổi chiều liên kết thành <strong>{detail.target_code} ➔ {detail.source_code}</strong>? Việc này sẽ kiểm tra tính hợp lệ của sơ đồ.
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="btn btn-secondary"
                        style={{ flex: 1, padding: "4px 8px", fontSize: 12 }}
                        onClick={() => setConfirmReverse(false)}
                      >
                        Huỷ
                      </button>
                      <button
                        className="btn btn-primary"
                        style={{ flex: 1, padding: "4px 8px", fontSize: 12, background: "var(--accent-blue)" }}
                        onClick={handleReverse}
                        disabled={reversing}
                      >
                        {reversing ? <Loader2 size={12} className="animate-spin" /> : "Xác nhận"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Delete edge */}
                {!confirmDelete ? (
                  <button
                    className="btn btn-secondary"
                    style={{
                      gap: 6,
                      justifyContent: "center",
                      borderColor: "rgba(248,81,73,0.3)",
                      color: "var(--accent-red)",
                    }}
                    onClick={() => {
                      setConfirmDelete(true);
                      setConfirmReverse(false);
                    }}
                  >
                    <Trash2 size={14} />
                    Xoá liên kết này
                  </button>
                ) : (
                  <div
                    style={{
                      background: "rgba(248,81,73,0.05)",
                      border: "1px solid rgba(248,81,73,0.2)",
                      borderRadius: 6,
                      padding: "12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <div style={{ fontSize: 12, color: "var(--text-primary)" }}>
                      Bạn có chắc chắn muốn xoá liên kết prerequisite giữa <strong>{detail.source_code}</strong> và <strong>{detail.target_code}</strong>? Hành động này không thể hoàn tác.
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="btn btn-secondary"
                        style={{ flex: 1, padding: "4px 8px", fontSize: 12 }}
                        onClick={() => setConfirmDelete(false)}
                      >
                        Huỷ
                      </button>
                      <button
                        className="btn"
                        style={{
                          flex: 1,
                          padding: "4px 8px",
                          fontSize: 12,
                          background: "var(--accent-red)",
                          color: "#fff",
                          border: "none",
                        }}
                        onClick={handleDelete}
                        disabled={deleting}
                      >
                        {deleting ? <Loader2 size={12} className="animate-spin" /> : "Xác nhận xoá"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
