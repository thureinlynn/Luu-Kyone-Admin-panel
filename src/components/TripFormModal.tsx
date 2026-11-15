import React, { useEffect, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Luggage,
  MapPin,
  MessageCircle,
  Send,
  X,
} from 'lucide-react';
import type {
  ItemCategory,
  Trip,
  TripFormInput,
  TripStatus,
  UserProfile,
} from '../types';
import { validateTripForm } from '../utils/analytics';

const LUU_KYONE_PARCEL_TYPES: ItemCategory[] = [
  'Urgent Documents & Letters',
  'Clothing & Fashion Goods',
  'Sealed Packaged Food & Snacks',
  'Electronics & Tech Accessories',
  'Cosmetics & Personal Care',
  'Books, Stationery & Prints',
  'Gifts & Souvenirs',
  'Prescription Medicines (with receipt)',
];

const TRIP_STATUSES: TripStatus[] = ['Active', 'Completed', 'Cancelled'];

interface TripFormModalProps {
  open: boolean;
  editingTrip?: Trip | null;
  users: UserProfile[];
  onClose: () => void;
  onSubmit: (input: TripFormInput) => Promise<void>;
}

function buildInitialState(
  editingTrip: Trip | null | undefined,
  users: UserProfile[],
): TripFormInput {
  if (editingTrip) {
    return {
      travelerId: editingTrip.travelerId,
      originCity: editingTrip.originCity,
      originCountry: editingTrip.originCountry || '',
      originCode: editingTrip.originCode,
      destinationCity: editingTrip.destinationCity,
      destinationCountry: editingTrip.destinationCountry || '',
      destinationCode: editingTrip.destinationCode,
      departureDate: editingTrip.departureDate,
      arrivalDate: editingTrip.arrivalDate,
      availableWeightKg: editingTrip.availableWeightKg,
      departureHandoverSpot: editingTrip.departureHandoverSpot || '',
      destinationPickupSpot: editingTrip.destinationPickupSpot || '',
      acceptedCategories: editingTrip.acceptedCategories,
      status: editingTrip.status,
      notes: editingTrip.notes || '',
      contactChannels: {
        whatsapp: editingTrip.contactChannels?.whatsapp || '',
        telegram: editingTrip.contactChannels?.telegram || '',
        facebook: editingTrip.contactChannels?.facebook || '',
        viber: editingTrip.contactChannels?.viber || '',
      },
    };
  }
  const defaultTraveler =
    users.find((u) => u.role === 'traveler' && u.accountStatus === 'Active') ||
    users[0];
  return {
    travelerId: defaultTraveler?.id || '',
    originCity: '',
    originCountry: '',
    originCode: '',
    destinationCity: 'Yangon',
    destinationCountry: 'Myanmar',
    destinationCode: 'RGN',
    departureDate: '2026-12-01',
    arrivalDate: '2026-12-02',
    availableWeightKg: 10,
    departureHandoverSpot: '',
    destinationPickupSpot: '',
    acceptedCategories: [
      'Urgent Documents & Letters',
      'Cosmetics & Personal Care',
    ],
    status: 'Active',
    notes: '',
    contactChannels: {
      whatsapp: defaultTraveler?.phone || '',
      telegram: '',
      facebook: '',
      viber: '',
    },
  };
}

export function TripFormModal({
  open,
  editingTrip,
  users,
  onClose,
  onSubmit,
}: TripFormModalProps) {
  const [form, setForm] = useState<TripFormInput>(() =>
    buildInitialState(editingTrip, users),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(buildInitialState(editingTrip, users));
      setErrors({});
    }
  }, [open, editingTrip, users]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const toggleCategory = (cat: ItemCategory) => {
    setForm((prev) => {
      const exists = prev.acceptedCategories.includes(cat);
      const next = exists
        ? prev.acceptedCategories.filter((c) => c !== cat)
        : [...prev.acceptedCategories, cat];
      return { ...prev, acceptedCategories: next };
    });
  };

  const handleTravelerChange = (travelerId: string) => {
    const selected = users.find((u) => u.id === travelerId);
    setForm((prev) => ({
      ...prev,
      travelerId,
      contactChannels: {
        ...prev.contactChannels,
        whatsapp: prev.contactChannels.whatsapp || selected?.phone || '',
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validateTripForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(form);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/45 backdrop-blur-[1px] sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trip-modal-title"
    >
      <div className="flex flex-col w-full sm:max-w-2xl h-[100dvh] sm:h-auto sm:max-h-[90vh] rounded-none sm:rounded-2xl border-0 sm:border sm:border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Sticky Modal Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3.5 sm:px-6 sm:py-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
              <Luggage className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2
                id="trip-modal-title"
                className="font-display text-base sm:text-lg font-bold text-slate-900 truncate"
              >
                {editingTrip
                  ? `Edit Traveler Trip #${editingTrip.tripCode}`
                  : 'Post a Traveler Trip'}
              </h2>
              <p className="text-xs text-slate-500 truncate">
                Share your extra baggage allowance with senders
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close trip form"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Form matching Luu Kyone App & DB */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col min-h-0"
          noValidate
        >
          <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 space-y-6">
            {/* Admin Assignment Bar */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className={editingTrip ? '' : 'sm:col-span-2'}>
                  <label
                    htmlFor="trip-traveler"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Traveler Profile <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="trip-traveler"
                    value={form.travelerId}
                    onChange={(e) => handleTravelerChange(e.target.value)}
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="">Select traveler...</option>
                    {users
                      .filter((u) => u.role !== 'admin')
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.handle}) — {u.verificationStatus}
                        </option>
                      ))}
                  </select>
                  {errors.travelerId && (
                    <p className="mt-1 text-xs text-red-600">
                      {errors.travelerId}
                    </p>
                  )}
                </div>

                {editingTrip && (
                  <div>
                    <label
                      htmlFor="trip-status"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Trip Status
                    </label>
                    <select
                      id="trip-status"
                      value={form.status}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          status: e.target.value as TripStatus,
                        }))
                      }
                      className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      {TRIP_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* 1. TRAVEL ROUTE & BAGGAGE SPACE */}
            <section className="space-y-3.5 border-b border-slate-200 pb-6">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
                <MapPin
                  className="h-3.5 w-3.5 text-amber-600 shrink-0"
                  aria-hidden="true"
                />
                <span>1. Travel Route &amp; Baggage Space</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label
                    htmlFor="trip-origin-city"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Departure City <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="trip-origin-city"
                    type="text"
                    placeholder="e.g. Bangkok"
                    value={form.originCity}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, originCity: e.target.value }))
                    }
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  {errors.originCity && (
                    <p className="mt-1 text-xs text-red-600">
                      {errors.originCity}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="trip-origin-country"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Departure Country
                  </label>
                  <input
                    id="trip-origin-country"
                    type="text"
                    placeholder="e.g. Thailand"
                    value={form.originCountry}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, originCountry: e.target.value }))
                    }
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="trip-dest-city"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Arrival City <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="trip-dest-city"
                    type="text"
                    placeholder="e.g. Yangon"
                    value={form.destinationCity}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        destinationCity: e.target.value,
                      }))
                    }
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  {errors.destinationCity && (
                    <p className="mt-1 text-xs text-red-600">
                      {errors.destinationCity}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="trip-dest-country"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Arrival Country
                  </label>
                  <input
                    id="trip-dest-country"
                    type="text"
                    placeholder="e.g. Myanmar"
                    value={form.destinationCountry}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        destinationCountry: e.target.value,
                      }))
                    }
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label
                    htmlFor="trip-weight"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700"
                  >
                    <Luggage
                      className="h-3.5 w-3.5 text-indigo-600 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      Available Luggage Weight (kg){' '}
                      <span className="text-red-500">*</span>
                    </span>
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Spare baggage capacity
                  </span>
                </div>
                <div className="relative">
                  <input
                    id="trip-weight"
                    type="number"
                    min={1}
                    step={0.5}
                    placeholder="e.g. 5, 10, or 23"
                    value={form.availableWeightKg}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        availableWeightKg: Number(e.target.value),
                      }))
                    }
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white pl-3.5 pr-10 py-2 text-sm font-mono tabular-nums text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">
                    kg
                  </span>
                </div>
                {errors.availableWeightKg && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.availableWeightKg}
                  </p>
                )}
              </div>
            </section>

            {/* 2. KEY DATES (DROP-OFF & DELIVERY) */}
            <section className="space-y-3.5 border-b border-slate-200 pb-6">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
                <Calendar
                  className="h-3.5 w-3.5 text-indigo-600 shrink-0"
                  aria-hidden="true"
                />
                <span>2. Key Dates (Drop-Off &amp; Delivery)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="rounded-xl border border-rose-200 bg-rose-50/45 p-3.5">
                  <label
                    htmlFor="trip-dep-date"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 mb-2"
                  >
                    <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>
                      Last Drop-Off Date <span className="text-red-500">*</span>
                    </span>
                  </label>
                  <input
                    id="trip-dep-date"
                    type="date"
                    value={form.departureDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, departureDate: e.target.value }))
                    }
                    className="w-full min-h-[42px] rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  />
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    Must be after today (deadline for senders)
                  </p>
                  {errors.departureDate && (
                    <p className="mt-1 text-xs text-red-600">
                      {errors.departureDate}
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/45 p-3.5">
                  <label
                    htmlFor="trip-arr-date"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 mb-2"
                  >
                    <CheckCircle2
                      className="h-3.5 w-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      Check-Out / Delivery Date{' '}
                      <span className="text-red-500">*</span>
                    </span>
                  </label>
                  <input
                    id="trip-arr-date"
                    type="date"
                    value={form.arrivalDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, arrivalDate: e.target.value }))
                    }
                    className="w-full min-h-[42px] rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    When receiver can collect the item (on or after drop-off)
                  </p>
                  {errors.arrivalDate && (
                    <p className="mt-1 text-xs text-red-600">
                      {errors.arrivalDate}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* 3. HANDOVER & PICKUP LOCATIONS + ACCEPTED PARCEL TYPES */}
            <section className="space-y-4 border-b border-slate-200 pb-6">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
                <MapPin
                  className="h-3.5 w-3.5 text-indigo-600 shrink-0"
                  aria-hidden="true"
                />
                <span>3. Handover &amp; Pickup Locations</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label
                    htmlFor="trip-handover-spot"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Departure Handover Spot
                  </label>
                  <input
                    id="trip-handover-spot"
                    type="text"
                    placeholder="e.g. BTS Asok or Suvarnabhumi Airport Gate"
                    value={form.departureHandoverSpot}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        departureHandoverSpot: e.target.value,
                      }))
                    }
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="trip-pickup-spot"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Destination Pickup Spot
                  </label>
                  <input
                    id="trip-pickup-spot"
                    type="text"
                    placeholder="e.g. Junction City Mall or Yangon Airport Arrival"
                    value={form.destinationPickupSpot}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        destinationPickupSpot: e.target.value,
                      }))
                    }
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-700 mb-2.5">
                  Accepted Parcel Types
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {LUU_KYONE_PARCEL_TYPES.map((cat) => {
                    const checked = form.acceptedCategories.includes(cat);
                    return (
                      <label
                        key={cat}
                        className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs sm:text-sm cursor-pointer transition-colors min-h-[42px] ${
                          checked
                            ? 'border-indigo-500 bg-indigo-50/50 text-indigo-950 font-medium'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCategory(cat)}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0"
                        />
                        <span className="leading-snug">{cat}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* 4. TRIP ANNOUNCEMENT & INFORMATION NOTICE */}
            <section className="space-y-2.5 border-b border-slate-200 pb-6">
              <label
                htmlFor="trip-notes"
                className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-500 uppercase"
              >
                <Luggage
                  className="h-3.5 w-3.5 text-amber-600 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  4. Trip Announcement &amp; Information Notice{' '}
                  <span className="text-red-500">*</span>
                </span>
              </label>
              <p className="text-xs text-slate-500">
                Describe flight notes, space dimensions, handover timing, and
                any condition requirements.
              </p>
              <textarea
                id="trip-notes"
                rows={4}
                placeholder="e.g. Flying direct on Singapore Airlines SQ 638. Have 10 kg spare checked bag space. Can take sealed local snacks, clothes, or documents. Items must be inspected before packing. Drop off before 6 PM on Nov 11 at BTS Asok..."
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              {errors.notes && (
                <p className="text-xs text-red-600">{errors.notes}</p>
              )}
            </section>

            {/* 5. CONTACT CHANNELS */}
            <section className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
                  <MessageCircle
                    className="h-3.5 w-3.5 text-emerald-600 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    5. Contact Channels (WhatsApp, Telegram, Facebook, Viber){' '}
                    <span className="text-red-500">*</span>
                  </span>
                </div>
                <span className="inline-flex items-center self-start sm:self-auto rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800 whitespace-nowrap">
                  Direct Contact Buttons
                </span>
              </div>

              <p className="text-xs text-slate-500">
                These will generate direct clickable contact buttons on your
                trip post for senders to connect instantly.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label
                    htmlFor="trip-whatsapp"
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    <MessageCircle
                      className="h-3.5 w-3.5 text-emerald-600 shrink-0"
                      aria-hidden="true"
                    />
                    <span>WhatsApp Number</span>
                  </label>
                  <input
                    id="trip-whatsapp"
                    type="tel"
                    placeholder="+66 81 234 5678"
                    value={form.contactChannels.whatsapp || ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        contactChannels: {
                          ...f.contactChannels,
                          whatsapp: e.target.value,
                        },
                      }))
                    }
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-mono tabular-nums text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="trip-telegram"
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    <Send
                      className="h-3.5 w-3.5 text-sky-500 shrink-0"
                      aria-hidden="true"
                    />
                    <span>Telegram Handle</span>
                  </label>
                  <input
                    id="trip-telegram"
                    type="text"
                    placeholder="@traveler_username"
                    value={form.contactChannels.telegram || ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        contactChannels: {
                          ...f.contactChannels,
                          telegram: e.target.value,
                        },
                      }))
                    }
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="trip-facebook"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Facebook / Messenger
                  </label>
                  <input
                    id="trip-facebook"
                    type="text"
                    placeholder="m.me/username"
                    value={form.contactChannels.facebook || ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        contactChannels: {
                          ...f.contactChannels,
                          facebook: e.target.value,
                        },
                      }))
                    }
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="trip-viber"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Viber Number
                  </label>
                  <input
                    id="trip-viber"
                    type="tel"
                    placeholder="+95 9 123 456 789"
                    value={form.contactChannels.viber || ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        contactChannels: {
                          ...f.contactChannels,
                          viber: e.target.value,
                        },
                      }))
                    }
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-mono tabular-nums text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>
              {errors.contactChannels && (
                <p className="text-xs text-red-600">{errors.contactChannels}</p>
              )}
            </section>
          </div>

          {/* Sticky Responsive Footer */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50/80 px-4 py-3.5 sm:px-6 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] sm:min-h-0 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm sm:text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[44px] sm:min-h-0 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm sm:text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors whitespace-nowrap"
            >
              {submitting
                ? 'Saving...'
                : editingTrip
                  ? 'Save Changes'
                  : 'Publish Trip'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
