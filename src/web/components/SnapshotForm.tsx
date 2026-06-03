import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ImagePlus, Save } from "lucide-react";
import { DEFAULT_TIMEZONE, GAME_MODE_LABELS, GAME_MODES } from "../../shared/constants";
import type { Snapshot, SnapshotCreateInput, ValidationWarning } from "../../shared/types";
import { getConsistencyWarnings } from "../../shared/schema";
import {
  fileLastModifiedIso,
  getImageDimensions,
  sha256File
} from "../lib/imageLocal";

type SnapshotFormValues = {
  observed_date: string;
  observed_time: string;
  timezone: string;
  game_mode: SnapshotCreateInput["game_mode"];
  player_name: string;
  player_id: string;
  rank_name: string;
  rank_level: string;
  rank_points: string;
  rank_points_max: string;
  matches: string;
  avg_win_score: string;
  avg_place: string;
  max_renchan: string;
  avg_win_turn: string;
  first_rate: string;
  second_rate: string;
  third_rate: string;
  fourth_rate: string;
  bust_rate: string;
  win_rate: string;
  tsumo_rate: string;
  deal_in_rate: string;
  call_rate: string;
  riichi_rate: string;
  note: string;
  source_image_sha256: string;
  file_name: string;
  file_last_modified: string;
  exif_taken_at: string;
  image_width: string;
  image_height: string;
  parser_version: string;
};

type SnapshotFormProps = {
  initialSnapshot?: Snapshot;
  submitLabel: string;
  onSubmit: (input: SnapshotCreateInput) => Promise<ValidationWarning[]>;
};

const today = new Date().toISOString().slice(0, 10);

function toValues(snapshot?: Snapshot): SnapshotFormValues {
  return {
    observed_date: snapshot?.observed_date ?? today,
    observed_time: snapshot?.observed_time ?? "",
    timezone: snapshot?.timezone ?? DEFAULT_TIMEZONE,
    game_mode: snapshot?.game_mode ?? "east",
    player_name: snapshot?.player_name ?? "",
    player_id: snapshot?.player_id ?? "",
    rank_name: snapshot?.rank_name ?? "",
    rank_level: snapshot?.rank_level?.toString() ?? "",
    rank_points: snapshot?.rank_points?.toString() ?? "",
    rank_points_max: snapshot?.rank_points_max?.toString() ?? "",
    matches: snapshot?.matches?.toString() ?? "",
    avg_win_score: snapshot?.avg_win_score?.toString() ?? "",
    avg_place: snapshot?.avg_place?.toString() ?? "",
    max_renchan: snapshot?.max_renchan?.toString() ?? "",
    avg_win_turn: snapshot?.avg_win_turn?.toString() ?? "",
    first_rate: snapshot?.first_rate?.toString() ?? "",
    second_rate: snapshot?.second_rate?.toString() ?? "",
    third_rate: snapshot?.third_rate?.toString() ?? "",
    fourth_rate: snapshot?.fourth_rate?.toString() ?? "",
    bust_rate: snapshot?.bust_rate?.toString() ?? "",
    win_rate: snapshot?.win_rate?.toString() ?? "",
    tsumo_rate: snapshot?.tsumo_rate?.toString() ?? "",
    deal_in_rate: snapshot?.deal_in_rate?.toString() ?? "",
    call_rate: snapshot?.call_rate?.toString() ?? "",
    riichi_rate: snapshot?.riichi_rate?.toString() ?? "",
    note: snapshot?.note ?? "",
    source_image_sha256: snapshot?.source_image_sha256 ?? "",
    file_name: snapshot?.file_name ?? "",
    file_last_modified: snapshot?.file_last_modified ?? "",
    exif_taken_at: snapshot?.exif_taken_at ?? "",
    image_width: snapshot?.image_width?.toString() ?? "",
    image_height: snapshot?.image_height?.toString() ?? "",
    parser_version: snapshot?.parser_version ?? ""
  };
}

function nullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function nullableNumber(value: string): number | null {
  return value.trim() === "" ? null : Number(value);
}

function requiredNumber(value: string): number {
  return Number(value);
}

function hasRequiredStats(values: SnapshotFormValues): boolean {
  return [
    values.observed_date,
    values.observed_time,
    values.matches,
    values.avg_place,
    values.first_rate,
    values.second_rate,
    values.third_rate,
    values.fourth_rate,
    values.win_rate,
    values.deal_in_rate,
    values.call_rate,
    values.riichi_rate
  ].every((value) => value.trim() !== "");
}

function buildInput(values: SnapshotFormValues): SnapshotCreateInput {
  return {
    observed_date: values.observed_date,
    observed_time: values.observed_time,
    timezone: DEFAULT_TIMEZONE,
    game_mode: values.game_mode,
    player_name: nullableText(values.player_name),
    player_id: nullableText(values.player_id),
    rank_name: nullableText(values.rank_name),
    rank_level: nullableNumber(values.rank_level),
    rank_points: nullableNumber(values.rank_points),
    rank_points_max: nullableNumber(values.rank_points_max),
    matches: requiredNumber(values.matches),
    avg_win_score: nullableNumber(values.avg_win_score),
    avg_place: requiredNumber(values.avg_place),
    max_renchan: nullableNumber(values.max_renchan),
    avg_win_turn: nullableNumber(values.avg_win_turn),
    first_rate: requiredNumber(values.first_rate),
    second_rate: requiredNumber(values.second_rate),
    third_rate: requiredNumber(values.third_rate),
    fourth_rate: requiredNumber(values.fourth_rate),
    bust_rate: nullableNumber(values.bust_rate),
    win_rate: requiredNumber(values.win_rate),
    tsumo_rate: nullableNumber(values.tsumo_rate),
    deal_in_rate: requiredNumber(values.deal_in_rate),
    call_rate: requiredNumber(values.call_rate),
    riichi_rate: requiredNumber(values.riichi_rate),
    note: nullableText(values.note),
    source_image_sha256: nullableText(values.source_image_sha256),
    file_name: nullableText(values.file_name),
    file_last_modified: nullableText(values.file_last_modified),
    exif_taken_at: nullableText(values.exif_taken_at),
    image_width: nullableNumber(values.image_width),
    image_height: nullableNumber(values.image_height),
    parser_version: nullableText(values.parser_version)
  };
}

export function SnapshotForm({
  initialSnapshot,
  submitLabel,
  onSubmit
}: SnapshotFormProps) {
  const [values, setValues] = useState<SnapshotFormValues>(() =>
    toValues(initialSnapshot)
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [serverWarnings, setServerWarnings] = useState<ValidationWarning[]>([]);

  useEffect(() => {
    setValues(toValues(initialSnapshot));
  }, [initialSnapshot]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const localWarnings = useMemo(() => {
    if (!hasRequiredStats(values)) return [];
    try {
      return getConsistencyWarnings(buildInput(values));
    } catch {
      return [];
    }
  }, [values]);

  const setField =
    (field: keyof SnapshotFormValues) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setValues((current) => ({ ...current, [field]: event.target.value }));
    };

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setMessage("Reading local image metadata...");

    try {
      const [hash, dimensions] = await Promise.all([
        sha256File(file),
        getImageDimensions(file)
      ]);

      setValues((current) => ({
        ...current,
        source_image_sha256: hash,
        file_name: file.name,
        file_last_modified: fileLastModifiedIso(file),
        image_width: String(dimensions.width),
        image_height: String(dimensions.height),
        parser_version: "manual-v1"
      }));
      setMessage("Local image metadata is ready. The image itself stays in the browser.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Image metadata failed.");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setServerWarnings([]);

    try {
      const warnings = await onSubmit(buildInput(values));
      setServerWarnings(warnings);
      setMessage("Snapshot saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Snapshot save failed.");
    } finally {
      setBusy(false);
    }
  }

  const warnings = [...localWarnings, ...serverWarnings];

  return (
    <form className="snapshot-form" onSubmit={handleSubmit}>
      <section className="form-section">
        <h2>Observation</h2>
        <div className="form-grid">
          <label>
            <span>Date</span>
            <input
              required
              type="date"
              value={values.observed_date}
              onChange={setField("observed_date")}
            />
          </label>
          <label>
            <span>Time</span>
            <input
              required
              type="time"
              step={60}
              value={values.observed_time}
              onChange={setField("observed_time")}
            />
          </label>
          <label>
            <span>Timezone</span>
            <input value={DEFAULT_TIMEZONE} readOnly />
          </label>
          <label>
            <span>Mode</span>
            <select value={values.game_mode} onChange={setField("game_mode")}>
              {GAME_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {GAME_MODE_LABELS[mode]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="form-section">
        <h2>Rank</h2>
        <div className="form-grid">
          <label>
            <span>Player name</span>
            <input value={values.player_name} maxLength={80} onChange={setField("player_name")} />
          </label>
          <label>
            <span>Rank name</span>
            <input value={values.rank_name} maxLength={40} onChange={setField("rank_name")} />
          </label>
          <label>
            <span>Rank level</span>
            <input type="number" min={0} max={20} value={values.rank_level} onChange={setField("rank_level")} />
          </label>
          <label>
            <span>Rank points</span>
            <input type="number" min={0} value={values.rank_points} onChange={setField("rank_points")} />
          </label>
          <label>
            <span>Point max</span>
            <input type="number" min={1} value={values.rank_points_max} onChange={setField("rank_points_max")} />
          </label>
        </div>
      </section>

      <section className="form-section">
        <h2>Match Summary</h2>
        <div className="form-grid">
          <label>
            <span>Matches</span>
            <input required type="number" min={0} value={values.matches} onChange={setField("matches")} />
          </label>
          <label>
            <span>Average place</span>
            <input required type="number" min={1} max={4} step="0.01" value={values.avg_place} onChange={setField("avg_place")} />
          </label>
          <label>
            <span>Average win score</span>
            <input type="number" min={0} value={values.avg_win_score} onChange={setField("avg_win_score")} />
          </label>
          <label>
            <span>Max renchan</span>
            <input type="number" min={0} value={values.max_renchan} onChange={setField("max_renchan")} />
          </label>
          <label>
            <span>Average win turn</span>
            <input type="number" min={0} step="0.01" value={values.avg_win_turn} onChange={setField("avg_win_turn")} />
          </label>
        </div>
      </section>

      <section className="form-section">
        <h2>Placement Rates</h2>
        <div className="form-grid">
          {[
            ["first_rate", "First"],
            ["second_rate", "Second"],
            ["third_rate", "Third"],
            ["fourth_rate", "Fourth"],
            ["bust_rate", "Bust"]
          ].map(([field, label]) => (
            <label key={field}>
              <span>{label}</span>
              <input
                required={field !== "bust_rate"}
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={values[field as keyof SnapshotFormValues]}
                onChange={setField(field as keyof SnapshotFormValues)}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="form-section">
        <h2>Action Rates</h2>
        <div className="form-grid">
          {[
            ["win_rate", "Win"],
            ["tsumo_rate", "Tsumo"],
            ["deal_in_rate", "Deal-in"],
            ["call_rate", "Call"],
            ["riichi_rate", "Riichi"]
          ].map(([field, label]) => (
            <label key={field}>
              <span>{label}</span>
              <input
                required={field !== "tsumo_rate"}
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={values[field as keyof SnapshotFormValues]}
                onChange={setField(field as keyof SnapshotFormValues)}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="form-section">
        <h2>Notes And Local Image</h2>
        <label className="wide-label">
          <span>Note</span>
          <textarea
            value={values.note}
            maxLength={5000}
            rows={4}
            onChange={setField("note")}
          />
        </label>
        <div className="image-row">
          <label className="file-button">
            <ImagePlus size={18} aria-hidden="true" />
            <span>Choose local image</span>
            <input type="file" accept="image/*" onChange={handleFileChange} />
          </label>
          {previewUrl ? <img className="local-preview" src={previewUrl} alt="" /> : null}
        </div>
        <div className="form-grid metadata-grid">
          <label>
            <span>SHA-256</span>
            <input value={values.source_image_sha256} onChange={setField("source_image_sha256")} />
          </label>
          <label>
            <span>File name</span>
            <input value={values.file_name} maxLength={255} onChange={setField("file_name")} />
          </label>
          <label>
            <span>Last modified</span>
            <input value={values.file_last_modified} onChange={setField("file_last_modified")} />
          </label>
          <label>
            <span>Width</span>
            <input type="number" min={1} value={values.image_width} onChange={setField("image_width")} />
          </label>
          <label>
            <span>Height</span>
            <input type="number" min={1} value={values.image_height} onChange={setField("image_height")} />
          </label>
        </div>
      </section>

      {warnings.length > 0 ? (
        <div className="warning-list" role="status">
          {warnings.map((warning, index) => (
            <div key={`${warning.code}-${index}`}>
              <AlertTriangle size={16} aria-hidden="true" />
              <span>{warning.message}</span>
            </div>
          ))}
        </div>
      ) : null}

      {message ? <p className="form-message">{message}</p> : null}

      <div className="form-actions">
        <button type="submit" className="primary-button" disabled={busy}>
          <Save size={18} aria-hidden="true" />
          <span>{busy ? "Saving" : submitLabel}</span>
        </button>
      </div>
    </form>
  );
}
