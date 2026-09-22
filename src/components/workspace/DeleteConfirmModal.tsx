import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description?: string;
  isDeleting?: boolean;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description = "Are you sure you want to permanently delete this document? This action cannot be undone.",
  isDeleting = false
}: DeleteConfirmModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-6 bg-white rounded-3xl border border-slate-200 shadow-2xl">
        <DialogHeader className="space-y-2">
          <div className="h-12 w-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 mb-2">
            <Trash2 className="h-6 w-6" />
          </div>
          <DialogTitle className="text-xl font-black tracking-tight text-slate-900">
            Delete "{title}"?
          </DialogTitle>
          <p className="text-sm text-slate-500 font-medium leading-relaxed">
            {description}
          </p>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-slate-100 mt-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="rounded-xl font-bold border-slate-200"
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            className="rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-100"
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Permanently
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
