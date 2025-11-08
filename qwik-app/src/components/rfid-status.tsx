import { component$, type PropFunction } from "@builder.io/qwik";

export interface RFIDData {
  id: number;
  rfid_data: string;
  rfid_status: boolean;
  status_text: string;
  created_at?: string;
  updated_at?: string;
}

interface RFIDStatusProps {
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
        <div class="flex items-center justify-center py-8">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
                  <label
                    class={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${
                      rfid.rfid_status ? "bg-green-500" : "bg-gray-300"
                    } ${togglingId === rfid.id ? "opacity-60" : "cursor-pointer"}`}
                  >
                    <input
                      type="checkbox"
                      class="sr-only"
                      checked={rfid.rfid_status}
                      disabled={togglingId === rfid.id}
                      onInput$={(event) =>
                        onToggle$(
                          rfid,
                          (event.target as HTMLInputElement).checked,
                        )
                      }
                    />
                    <span
                      class={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
                        rfid.rfid_status ? "translate-x-7" : "translate-x-1"
                      }`}
                    />
                  </label>
                  <span class="ml-3 font-mono text-sm text-gray-700">
                    {rfid.status_text}
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

