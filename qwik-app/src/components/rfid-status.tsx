import { component$, type PropFunction } from "@builder.io/qwik";

export interface RFIDData {
  id: number;
  rfid_data: string;
  rfid_status: boolean;
  status_text: string;
  created_at?: string;
  updated_at?: string;
}

export interface RFIDStatusProps {
  registered: RFIDData[];
  loading: boolean;
  onToggle$?: PropFunction<(rfid: RFIDData, nextStatus: boolean) => void>;
  togglingId?: number | null;
}

export const RFIDStatus = component$<RFIDStatusProps>(
  ({ registered, loading, onToggle$, togglingId = null }) => {
  return (
    <div class="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 class="text-2xl font-bold mb-4 text-gray-800">Registered RFID Cards</h2>
      
      {loading ? (
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((placeholder) => (
            <div
              key={`rfid-skeleton-${placeholder}`}
              class="border rounded-lg p-4 animate-pulse bg-gray-50"
            >
              <div class="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div class="h-3 bg-gray-200 rounded w-2/3 mb-2"></div>
              <div class="h-3 bg-gray-100 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : registered.length === 0 ? (
        <p class="text-gray-500 text-center py-4">No registered RFID cards found.</p>
      ) : (
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {registered.map((rfid) => (
            <div
              key={rfid.id}
              class="border rounded-lg p-4 hover:shadow-lg transition-shadow"
            >
              <div class="flex justify-between items-start mb-2">
                <h3 class="font-mono text-lg font-semibold text-gray-700">
                  {rfid.rfid_data}
                </h3>
                <span
                  class={`px-3 py-1 rounded-full text-xs font-medium ${
                    rfid.rfid_status
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {rfid.status_text}
                </span>
              </div>
              <div class="text-sm text-gray-500">
                <p>ID: {rfid.id}</p>
              </div>
              {onToggle$ && (
                <div class="mt-4 flex items-center justify-between">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={rfid.rfid_status}
                    aria-label={rfid.rfid_status ? "Deactivate RFID card" : "Activate RFID card"}
                    aria-disabled="true"
                    disabled={true}
                    class={`relative inline-flex h-9 w-16 items-center rounded-full transition-all duration-300 ease-in-out opacity-60 cursor-not-allowed ${
                      rfid.rfid_status
                        ? "bg-green-500"
                        : "bg-gray-300"
                    }`}
                  >
                    <span
                      class={`inline-block h-7 w-7 transform rounded-full bg-white shadow-lg transition-all duration-300 ease-in-out opacity-50 ${
                        rfid.rfid_status
                          ? "translate-x-9"
                          : "translate-x-1"
                      }`}
                    />
                  </button>
                  <span class="ml-3 text-sm font-medium text-gray-700">
                    {rfid.rfid_status ? (
                      <span class="text-green-600 font-semibold">Active</span>
                    ) : (
                      <span class="text-gray-500">Inactive</span>
                    )}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
);

