"use client";

import { useState } from "react";
import { SegmentedControl } from "@/components/SegmentedControl";
import { CameraSender, type CameraLayout } from "@/components/camera/CameraSender";
import { CameraReceiver } from "@/components/camera/CameraReceiver";

export type OpticalRole = "send" | "receive";
export type { CameraLayout };

export function CameraStreamCard() {
  const [role, setRole] = useState<OpticalRole>("send");

  return (
    <div className="space-y-6" translate="no">
      {/* Header & Role Switcher */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-[var(--border-hairline)]">
        <div>
          <h3 className="font-bold text-base text-[var(--text)]">Via Camera Scan</h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Zero-network air-gapped data transfer. Stream files as animated QR codes to any phone or laptop camera.
          </p>
        </div>

        <SegmentedControl
          value={role}
          onChange={(newRole) => setRole(newRole as OpticalRole)}
          options={[
            { value: "send", label: "Stream / Send" },
            { value: "receive", label: "Scan / Receive" },
          ]}
          ariaLabel="Optical camera transfer role"
        />
      </div>

      {/* Active Role Content */}
      {role === "send" ? <CameraSender /> : <CameraReceiver />}
    </div>
  );
}

export default CameraStreamCard;
