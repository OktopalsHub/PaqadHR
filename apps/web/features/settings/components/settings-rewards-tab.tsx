"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ContentCard } from "@/components/content-card";
import { LoadingBlock } from "@/components/loading-block";
import { Wallet, X, Trash2 } from "lucide-react";
import {
  SettingsFieldHint,
} from "@/features/settings/components/settings-field-hint";
import { SettingsFormActions } from "@/features/settings/components/settings-form-actions";
import {
  usePatchTenantSettings,
  useTenantSettings,
} from "@/hooks/queries/use-tenant-settings";
import {
  useCreateCustomReward,
  useCustomRewards,
  useDeleteCustomReward,
  useTenantWallet,
  useReloadlyCountries,
} from "@/hooks/queries/use-rewards";
import { PAQ_POINTS_NAME } from "@/lib/constants/paq-points";

const FLAG_MAP: Record<string, string> = {
  NG: "🇳🇬",
  US: "🇺🇸",
  GB: "🇬🇧",
  CA: "🇨🇦",
  GH: "🇬🇭",
  KE: "🇰🇪",
  ZA: "🇿🇦",
  FR: "🇫🇷",
  DE: "🇩🇪",
  IN: "🇮🇳",
  AE: "🇦🇪",
  ES: "🇪🇸",
  IT: "🇮🇹",
  BR: "🇧🇷",
  MX: "🇲🇽",
  CN: "🇨🇳",
  JP: "🇯🇵",
  KR: "🇰🇷",
  RU: "🇷🇺",
  AU: "🇦🇺",
  SG: "🇸🇬",
};

const PRESET_COUNTRIES = [
  { code: "NG", name: "Nigeria" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "GH", name: "Ghana" },
  { code: "KE", name: "Kenya" },
  { code: "ZA", name: "South Africa" },
];

export function SettingsRewardsTab() {
  const { data: settings, isLoading } = useTenantSettings();
  const { data: wallet } = useTenantWallet();
  const { data: customRewards = [], isLoading: rewardsLoading } =
    useCustomRewards();
  const { data: dynamicCountries = [] } = useReloadlyCountries();
  const patchSettings = usePatchTenantSettings();
  const createReward = useCreateCustomReward();
  const deleteReward = useDeleteCustomReward();

  const rewards = settings?.settings?.rewards;
  const [exchangeRate, setExchangeRate] = useState("10");
  const [currency, setCurrency] = useState("NGN");
  const [selectedCountries, setSelectedCountries] = useState<string[]>(["NG"]);
  const [selectValue, setSelectValue] = useState("");

  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPointsCost, setNewPointsCost] = useState("100");
  const [newInstructions, setNewInstructions] = useState("");

  useEffect(() => {
    if (rewards) {
      setExchangeRate(String(rewards.pointsExchangeRate ?? 10));
      setCurrency(rewards.rewardsCurrency ?? "NGN");
      setSelectedCountries(rewards.catalogCountries ?? ["NG"]);
    }
  }, [rewards]);

  if (isLoading || rewardsLoading) return <LoadingBlock />;

  const saveRewardsSettings = async () => {
    try {
      await patchSettings.mutateAsync({
        rewards: {
          enabled: true,
          pointsExchangeRate: Number(exchangeRate) || 10,
          rewardsCurrency: currency.trim().toUpperCase() || "NGN",
          catalogCountries: selectedCountries,
          airtimeEnabled: true,
          customRewardsEnabled: true,
        },
      });
      toast.success("Rewards settings saved successfully");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save settings",
      );
    }
  };

  const handleCreateReward = async () => {
    if (!newTitle.trim()) return;
    try {
      await createReward.mutateAsync({
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        pointsCost: Number(newPointsCost) || 100,
        deliveryInstructions: newInstructions.trim() || undefined,
      });
      setNewTitle("");
      setNewDescription("");
      setNewPointsCost("100");
      setNewInstructions("");
      toast.success("Custom reward perk created");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create reward",
      );
    }
  };

  const handleRemoveCountry = (code: string) => {
    setSelectedCountries(selectedCountries.filter((c) => c !== code));
  };

  const handleAddCountry = (code: string) => {
    setSelectValue("");

    if (code === "CUSTOM") {
      const customCode = prompt(
        "Enter 2-letter ISO country code (e.g. CA, ES, BR):",
      );
      if (customCode) {
        const formatted = customCode.trim().toUpperCase();
        if (formatted.length === 2 && !selectedCountries.includes(formatted)) {
          setSelectedCountries([...selectedCountries, formatted]);
        } else {
          toast.error(
            "Invalid or duplicate ISO code. Must be exactly 2 letters.",
          );
        }
      }
    } else if (code && !selectedCountries.includes(code)) {
      setSelectedCountries([...selectedCountries, code]);
    }
  };

  return (
    <div className="space-y-5">
      {}
      <ContentCard
        title="Rewards Wallet"
        description="Your tenant's internal wallet for funding gift card and airtime redemptions"
      >
        <div className="flex flex-wrap items-center gap-6 rounded-xl border border-dashed border-border/80 bg-muted/20 p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Wallet className="size-6" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {wallet?.currencyCode ?? "NGN"}{" "}
                {Number(wallet?.balanceAmount ?? 0).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Wallet Balance</p>
            </div>
          </div>
          {wallet?.virtualAccountNumber ? (
            <div className="rounded-lg border bg-background p-3 text-sm">
              <p className="text-xs text-muted-foreground">
                Fund via Bank Transfer
              </p>
              <p className="font-mono font-semibold">
                {wallet.virtualAccountNumber}
              </p>
              <p className="text-xs text-muted-foreground">
                {wallet.virtualAccountBank}
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Virtual account not yet provisioned. Contact support to enable
              automatic funding.
            </p>
          )}
        </div>
      </ContentCard>

      {}
      <ContentCard
        title="Rewards Configuration"
        description="Control the rewards system, exchange rates, and catalog"
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <SettingsFieldHint
              label="Points Exchange Rate"
              hint={`How many ${currency} equals 1 ${PAQ_POINTS_NAME.toLowerCase()}. E.g. 10 means 1 point = ${currency} 10.`}
            >
              <Input
                type="number"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
              />
            </SettingsFieldHint>
            <SettingsFieldHint
              label="Rewards Currency"
              hint="The currency used for reward pricing (e.g. NGN, USD)."
            >
              <Input
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              />
            </SettingsFieldHint>

            {}
            <SettingsFieldHint
              label="Gift Card Countries"
              hint="Select allowed countries for Reloadly catalog products. You can query and enable multiple countries concurrently."
              className="sm:col-span-2"
            >
              <div className="space-y-3 p-4 rounded-xl border bg-muted/10">
                <div className="flex flex-wrap gap-1.5 min-h-8 items-center">
                  {selectedCountries.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">
                      No countries selected. Catalog will be empty.
                    </span>
                  ) : (
                    selectedCountries.map((code) => {
                      const info = (() => {
                        const dynamic = dynamicCountries.find(
                          (d: any) => d.code === code,
                        );
                        if (dynamic)
                          return {
                            name: dynamic.name,
                            flag: FLAG_MAP[code] ?? "🌐",
                          };
                        const preset = PRESET_COUNTRIES.find(
                          (p) => p.code === code,
                        );
                        if (preset)
                          return {
                            name: preset.name,
                            flag: FLAG_MAP[code] ?? "🌐",
                          };
                        return { name: code, flag: FLAG_MAP[code] ?? "🌐" };
                      })();
                      return (
                        <Badge
                          key={code}
                          variant="secondary"
                          className="text-xs font-semibold py-1 pl-2 pr-1.5 flex items-center gap-1.5 border border-indigo-100 dark:border-indigo-950 bg-indigo-50/20 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300"
                        >
                          <span>{info.flag}</span>
                          <span>
                            {info.name} ({code})
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCountry(code)}
                            className="rounded-full p-0.5 hover:bg-muted-foreground/20 text-indigo-500/80 hover:text-indigo-600 transition-colors"
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      );
                    })
                  )}
                </div>

                <div className="pt-2 border-t flex justify-between items-center">
                  <span className="text-xs text-muted-foreground font-medium">
                    Add more countries:
                  </span>
                  <Select
                    value={selectValue}
                    onValueChange={handleAddCountry}
                  >
                    <SelectTrigger className="w-[200px] h-9 text-xs font-semibold">
                      <SelectValue placeholder="Add Country..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(() => {
                        const sourceList =
                          dynamicCountries.length > 0
                            ? dynamicCountries
                            : PRESET_COUNTRIES;
                        return sourceList
                          .filter(
                            (c: any) => !selectedCountries.includes(c.code),
                          )
                          .map((c: any) => (
                            <SelectItem
                              key={c.code}
                              value={c.code}
                              className="text-xs"
                            >
                              <span className="mr-2">
                                {FLAG_MAP[c.code] ?? "🌐"}
                              </span>{" "}
                              {c.name} ({c.code})
                            </SelectItem>
                          ));
                      })()}
                      <SelectItem
                        value="CUSTOM"
                        className="text-xs text-indigo-600 dark:text-indigo-400 font-bold"
                      >
                        ➕ Add Custom ISO Code
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </SettingsFieldHint>
          </div>
          <SettingsFormActions
            onSave={saveRewardsSettings}
            isPending={patchSettings.isPending}
          />
        </div>
      </ContentCard>

      {}
      <ContentCard
        title="Custom Rewards"
        description="Create company-specific rewards employees can claim"
      >
        <div className="space-y-3">
          {customRewards.map((reward: any) => (
            <div
              key={reward.id}
              className="flex items-center justify-between rounded-lg border border-border/60 p-3"
            >
              <div>
                <span className="font-medium">{reward.title}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {reward.pointsCost} {PAQ_POINTS_NAME}
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => deleteReward.mutateAsync(reward.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}

          <div className="space-y-2 rounded-lg border border-dashed border-border/60 p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Add New Reward
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                placeholder="Reward title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <Input
                type="number"
                placeholder="Points cost"
                value={newPointsCost}
                onChange={(e) => setNewPointsCost(e.target.value)}
              />
            </div>
            <Textarea
              placeholder="Description (optional)"
              rows={2}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
            />
            <Input
              placeholder="Delivery instructions (optional)"
              value={newInstructions}
              onChange={(e) => setNewInstructions(e.target.value)}
            />
            <Button
              size="sm"
              disabled={createReward.isPending || !newTitle.trim()}
              onClick={handleCreateReward}
            >
              Add Reward
            </Button>
          </div>
        </div>
      </ContentCard>
    </div>
  );
}
