'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, UserPlus } from 'lucide-react';
import { useAddCampaignContacts } from '@/hooks/useCampaigns';
import ContactSelector from '@/components/campaigns/ContactSelector';

interface AddRecipientsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
}

export default function AddRecipientsModal({ open, onOpenChange, campaignId }: AddRecipientsModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  const addContacts = useAddCampaignContacts(campaignId);

  const hasSelection = selectedIds.length > 0 || selectedTags.length > 0 || csvFile !== null;

  const resetState = () => {
    setSelectedIds([]);
    setSelectedTags([]);
    setCsvFile(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetState();
    onOpenChange(next);
  };

  const handleAdd = () => {
    addContacts.mutate(
      { contactIds: selectedIds, tags: selectedTags, csvFile: csvFile ?? undefined },
      {
        onSuccess: result => {
          const added = result.data.addedCount;
          handleOpenChange(false);
          console.info(`Added ${added} recipient(s) to campaign ${campaignId}`);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add recipients</DialogTitle>
          <DialogDescription>
            Pick contacts, select by tag, or upload a CSV. Duplicates are skipped automatically.
          </DialogDescription>
        </DialogHeader>

        {/* Explicit height so ContactSelector's h-full / absolute inset-0 panels resolve correctly */}
        <div className="h-[320px]">
          <ContactSelector
            selectedIds={selectedIds}
            onSelectedIdsChange={setSelectedIds}
            csvFile={csvFile}
            onCsvFileChange={setCsvFile}
            selectedTags={selectedTags}
            onSelectedTagsChange={setSelectedTags}
          />
        </div>

        <DialogFooter showCloseButton>
          <Button
            onClick={handleAdd}
            disabled={!hasSelection || addContacts.isPending}
            className="inline-flex items-center gap-2 bg-[hsl(var(--green))] hover:bg-[hsl(var(--green))]/90 text-white"
          >
            {addContacts.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <UserPlus className="w-3.5 h-3.5" />
            )}
            {addContacts.isPending ? 'Adding…' : 'Add recipients'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
