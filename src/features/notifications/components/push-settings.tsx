"use client";

import { Share } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { StrideMark } from "@/components/stride/stride-mark";
import { Switch } from "@/components/ui/switch";
import {
  applicationServerKey,
  deviceLabel,
  deviceName,
  isAppleMobile,
  pushCategories,
  pushCategoryCopy,
  pushDeviceState,
  type DeviceLabel,
  type PushCategory,
  type PushDeviceState,
  type PushPreferences,
} from "@/features/notifications/push";
import {
  PreferenceGroup,
  PreferenceSection,
} from "@/features/settings/components/preferences";
import { cn } from "@/lib/utils";
import {
  setPushPreference,
  subscribePush,
  unsubscribePush,
} from "@/server/push/actions";

type Device = {
  label: DeviceLabel | null;
  appleMobile: boolean;
  standalone: boolean;
  supported: boolean;
  permission: NotificationPermission;
  registration: ServiceWorkerRegistration | null;
  endpoint: string | null;
  registered: boolean;
};

const saveError = "Le réglage n’a pas pu être enregistré. Réessaie.";

async function detectDevice(
  configured: boolean,
  endpoints: readonly string[],
): Promise<Device> {
  const label = deviceLabel(navigator.userAgent, navigator.maxTouchPoints);
  const standalone =
    matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && navigator.standalone === true);
  const supported =
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;
  const device: Device = {
    label,
    appleMobile: isAppleMobile(label),
    standalone,
    supported,
    permission: supported ? Notification.permission : "default",
    registration: null,
    endpoint: null,
    registered: false,
  };
  if (!configured || !supported) return device;
  const registration = await navigator.serviceWorker
    .register("/sw.js", { scope: "/", updateViaCache: "none" })
    .catch(() => null);
  const subscription = await registration?.pushManager
    .getSubscription()
    .catch(() => null);
  const endpoint = subscription?.endpoint ?? null;
  return {
    ...device,
    registration,
    endpoint,
    registered: endpoint !== null && endpoints.includes(endpoint),
  };
}

function deviceStateOf(device: Device | null, configured: boolean) {
  if (!configured) return "unavailable";
  if (!device) return "checking";
  return pushDeviceState({
    configured,
    appleMobile: device.appleMobile,
    standalone: device.standalone,
    supported: device.supported,
    permission: device.permission,
    subscribed: device.registered,
  });
}

export function PushSettings({
  publicKey,
  preferences,
  endpoints,
}: {
  publicKey: string | null;
  preferences: PushPreferences;
  endpoints: string[];
}) {
  const configured = publicKey !== null;
  const [device, setDevice] = useState<Device | null>(null);
  const [pending, start] = useTransition();
  const [target, setTarget] = useState<boolean | null>(null);
  const [choices, setChoices] = useState(preferences);

  useEffect(() => {
    let active = true;
    void detectDevice(configured, endpoints).then((detected) => {
      if (active) setDevice(detected);
    });
    return () => {
      active = false;
    };
  }, [configured, endpoints]);

  const state: PushDeviceState = deviceStateOf(device, configured);

  function enable(current: Device) {
    const registration = current.registration;
    if (!registration || !publicKey) return;
    setTarget(true);
    start(async () => {
      try {
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(publicKey),
        });
        const { keys } = subscription.toJSON();
        const result = await subscribePush({
          endpoint: subscription.endpoint,
          keys: { p256dh: keys?.p256dh ?? "", auth: keys?.auth ?? "" },
          label: current.label,
        }).catch(() => ({ status: "error" as const }));
        if (result.status !== "saved") {
          await subscription.unsubscribe().catch(() => false);
          throw new Error(result.status);
        }
        setDevice({
          ...current,
          permission: "granted",
          endpoint: subscription.endpoint,
          registered: true,
        });
        toast.success("Notifications activées sur cet appareil.", {
          id: "push-device",
        });
      } catch {
        const permission = Notification.permission;
        setDevice({ ...current, permission });
        toast.error(
          permission === "denied"
            ? "Les notifications sont bloquées pour Stride sur cet appareil."
            : "Les notifications n’ont pas pu être activées. Réessaie.",
          { id: "push-device" },
        );
      } finally {
        setTarget(null);
      }
    });
  }

  function disable(current: Device) {
    const endpoint = current.endpoint;
    if (!endpoint) return;
    setTarget(false);
    start(async () => {
      const result = await unsubscribePush({ endpoint }).catch(() => ({
        status: "error" as const,
      }));
      if (result.status !== "saved") {
        setTarget(null);
        toast.error(saveError, { id: "push-device" });
        return;
      }
      const subscription = await current.registration?.pushManager
        .getSubscription()
        .catch(() => null);
      await subscription?.unsubscribe().catch(() => false);
      setDevice({ ...current, endpoint: null, registered: false });
      setTarget(null);
      toast.success("Notifications désactivées sur cet appareil.", {
        id: "push-device",
      });
    });
  }

  function choose(category: PushCategory, enabled: boolean) {
    setChoices((previous) => ({ ...previous, [category]: enabled }));
    start(async () => {
      const result = await setPushPreference({ category, enabled }).catch(
        () => ({ status: "error" as const }),
      );
      if (result.status !== "saved") {
        setChoices((previous) => ({ ...previous, [category]: !enabled }));
        toast.error(saveError, { id: "push-preferences" });
        return;
      }
      toast.success("Préférence de notification enregistrée.", {
        id: "push-preferences",
      });
    });
  }

  const showCategories = state === "off" || state === "on";
  const categoriesEnabled = state === "on";

  return (
    <PreferenceSection id="notifications" title="Notifications" grouped={false}>
      {state === "install" ? (
        <InstallSteps label={device?.label ?? null} />
      ) : (
        <PreferenceGroup>
          <DeviceRow
            state={state}
            device={device}
            checked={target ?? state === "on"}
            pending={pending && target !== null}
            onCheckedChange={(next) => {
              if (!device) return;
              if (next) enable(device);
              else disable(device);
            }}
          />
        </PreferenceGroup>
      )}
      {showCategories && (
        <>
          <PreferenceGroup className={cn(!categoriesEnabled && "opacity-55")}>
            {pushCategories.map((category) => (
              <CategoryRow
                key={category}
                category={category}
                checked={choices[category]}
                disabled={!categoriesEnabled}
                onCheckedChange={(next) => choose(category, next)}
              />
            ))}
          </PreferenceGroup>
          <p className="px-1.5 text-xs leading-snug text-muted-foreground md:px-0 md:pt-3">
            {categoriesEnabled
              ? "Tout reste dans ta cloche, même quand une notification est coupée ici."
              : "Active cet appareil pour choisir ce que tu reçois."}
          </p>
        </>
      )}
    </PreferenceSection>
  );
}

function deviceCopy(state: PushDeviceState, device: Device | null) {
  const appleMobile = device?.appleMobile ?? false;
  const name = deviceName(device?.label ?? null);
  switch (state) {
    case "checking":
      return {
        label: name,
        hint: "Vérification de cet appareil…",
        status: null,
      };
    case "unavailable":
      return {
        label: "Notifications indisponibles pour le moment",
        hint: "Les notifications push ne sont pas encore disponibles sur Stride. Tout reste dans ta cloche.",
        status: null,
      };
    case "unsupported":
      return {
        label: "Notifications indisponibles ici",
        hint: "Ce navigateur ne gère pas les notifications push. Tout reste dans ta cloche.",
        status: null,
      };
    case "denied":
      return {
        label: "Notifications bloquées",
        hint: appleMobile
          ? "Pour les réactiver : Réglages iOS › Notifications › Stride › Autoriser les notifications."
          : "Pour les réactiver, autorise les notifications de ce site dans les réglages de ton navigateur.",
        status: null,
      };
    case "on":
      return {
        label: name,
        hint: "Chaque appareil s’active à part.",
        status: "Activées",
      };
    default:
      return {
        label: name,
        hint: appleMobile
          ? "iOS te demandera ton accord."
          : "Ton navigateur te demandera ton accord.",
        status: "Désactivées",
      };
  }
}

function DeviceRow({
  state,
  device,
  checked,
  pending,
  onCheckedChange,
}: {
  state: PushDeviceState;
  device: Device | null;
  checked: boolean;
  pending: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const { label, hint, status } = deviceCopy(state, device);
  const toggle = state === "on" || state === "off";
  const lowerHint = hint.charAt(0).toLowerCase() + hint.slice(1);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-2.5 max-md:last:border-b-0 md:grid-cols-[13.75rem_minmax(0,1fr)] md:gap-x-6 md:px-0 md:py-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span id="push-device-label" className="text-body md:text-sm">
          {label}
        </span>
        <span
          id="push-device-hint"
          className="text-xs leading-snug text-muted-foreground"
          aria-live="polite"
        >
          {status ? (
            <>
              <span className="md:hidden">
                {status} · {lowerHint}
              </span>
              <span className="max-md:hidden">{hint}</span>
            </>
          ) : (
            hint
          )}
        </span>
      </div>
      {(toggle || state === "denied") && (
        <div className="flex items-center gap-3">
          <Switch
            checked={state === "denied" ? false : checked}
            disabled={!toggle || pending}
            onCheckedChange={onCheckedChange}
            aria-labelledby="push-device-label"
            aria-describedby="push-device-hint"
          />
          {status && (
            <span
              aria-hidden="true"
              className="text-sm text-muted max-md:hidden"
            >
              {checked ? "Activées" : "Désactivées"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function CategoryRow({
  category,
  checked,
  disabled,
  onCheckedChange,
}: {
  category: PushCategory;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const { label, hint } = pushCategoryCopy[category];
  const id = `push-${category}`;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-0.5 border-b border-border px-4 py-2.5 last:border-b-0 md:px-0 md:py-3.5">
      <span id={`${id}-label`} className="text-body md:text-sm">
        {label}
      </span>
      <Switch
        className="row-span-2"
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-hint`}
      />
      <span
        id={`${id}-hint`}
        className="text-xs leading-snug text-muted-foreground"
      >
        {hint}
      </span>
    </div>
  );
}

function InstallSteps({ label }: { label: DeviceLabel | null }) {
  const device = label === "iPad" ? "iPad" : "iPhone";
  return (
    <PreferenceGroup className="gap-3.5 p-4 md:rounded-card md:border md:bg-surface">
      <div className="flex items-center gap-3">
        <span className="grid size-9.5 shrink-0 place-items-center rounded-surface bg-accent">
          <StrideMark className="size-5 stroke-background" />
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="text-body font-semibold">
            Installe Stride sur ton {device}
          </span>
          <span className="text-xs leading-snug text-muted-foreground">
            Sur {device}, les notifications passent uniquement par l’app
            installée.
          </span>
        </div>
      </div>
      <ol className="flex flex-col gap-3">
        {[
          <>
            Touche{" "}
            <span className="inline-flex items-center gap-1 font-semibold">
              Partager
              <Share aria-hidden="true" className="size-3.5" />
            </span>{" "}
            dans la barre de Safari.
          </>,
          <>
            Choisis <span className="font-semibold">Sur l’écran d’accueil</span>
            , puis <span className="font-semibold">Ajouter</span>.
          </>,
          <>
            Ouvre Stride depuis son icône et reviens ici pour activer les
            notifications.
          </>,
        ].map((step, index) => (
          <li
            key={index}
            className="grid grid-cols-[1.75rem_minmax(0,1fr)] items-start gap-3 text-sm"
          >
            <span
              aria-hidden="true"
              className="grid size-7 place-items-center rounded-full border border-border-strong font-metric text-[15px] font-semibold"
            >
              {index + 1}
            </span>
            <span className="pt-1">{step}</span>
          </li>
        ))}
      </ol>
    </PreferenceGroup>
  );
}
