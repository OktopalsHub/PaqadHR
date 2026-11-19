'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { useOfferActions, useOffers } from '../../hooks/use-candidate-ats';
import { useEmailTemplates } from '../../hooks/use-recruitment-ats';
import { notifyError } from './candidate-notify';

export function CandidateOfferPanel({ candidateId }: { candidateId: string }) {
  const { data: offers = [] } = useOffers(candidateId);
  const { data: templates = [] } = useEmailTemplates();
  const actions = useOfferActions(candidateId);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('NGN');
  const [startDate, setStartDate] = useState('');
  const [templateId, setTemplateId] = useState('');

  const onCreate = () =>
    actions.create.mutate(
      { amount: Number(amount), currency, startDate: startDate || undefined },
      {
        onSuccess: () => {
          setAmount('');
          toast.success('Offer drafted');
        },
        onError: (error) => notifyError(error),
      },
    );

  return (
    <div className="space-y-4">
      {offers.map((offer) => (
        <div key={offer.id} className="space-y-2 rounded-md border p-3 text-sm">
          <p className="font-medium">
            {offer.currency} {Number(offer.amount).toLocaleString()} · {offer.status}
          </p>
          {offer.startDate ? <p className="text-slate-500">Starts {offer.startDate}</p> : null}
          {offer.status === 'DRAFT' ? (
            <div className="flex flex-wrap gap-2">
              <select
                aria-label="Offer email template"
                className="rounded-md border bg-transparent px-2 py-1"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                <option value="">Send without an email</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                disabled={actions.send.isPending}
                onClick={() =>
                  actions.send.mutate(
                    { offerId: offer.id, templateId: templateId || undefined },
                    {
                      onSuccess: () => toast.success('Offer sent'),
                      onError: (error) => notifyError(error),
                    },
                  )
                }
              >
                Send offer
              </Button>
            </div>
          ) : null}
          {offer.status === 'SENT' ? (
            <div className="flex gap-2">
              {(['ACCEPTED', 'DECLINED'] as const).map((outcome) => (
                <Button
                  key={outcome}
                  size="sm"
                  variant={outcome === 'ACCEPTED' ? 'default' : 'outline'}
                  disabled={actions.respond.isPending}
                  onClick={() =>
                    actions.respond.mutate(
                      { offerId: offer.id, outcome },
                      { onError: (error) => notifyError(error) },
                    )
                  }
                >
                  Mark {outcome.toLowerCase()}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      ))}

      <div className="space-y-2">
        <p className="text-sm font-medium">New offer</p>
        <div className="flex flex-wrap gap-2">
          <Input
            className="w-36"
            type="number"
            min={1}
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Input
            className="w-20"
            maxLength={3}
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
          />
          <Input
            className="w-40"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Button onClick={onCreate} disabled={!Number(amount) || currency.length !== 3}>
            Draft offer
          </Button>
        </div>
      </div>
    </div>
  );
}
