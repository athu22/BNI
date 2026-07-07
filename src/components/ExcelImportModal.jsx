import React, { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { collection, doc, writeBatch, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Button } from './ui/Button';
import { X, UploadCloud, AlertCircle, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ExcelImportModal({ isOpen, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 100
  const [results, setResults] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
      setResults(null);
      setProgress(0);
    }
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResults(null);
      setProgress(0);
    }
  };

  const validateRow = (row) => {
    const hasName = !!(row['Name'] || row['Member Name']);
    const hasChapter = !!(row['Chapter'] || row['Chapter Name']);
    return hasName && hasChapter;
  };

  const generateMemberCode = () => {
    return 'M-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    setProgress(10);
    try {
      const data = await file.arrayBuffer();
      setProgress(30);
      
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      let successCount = 0;
      let duplicateCount = 0;
      let failedCount = 0;
      
      setProgress(50);
      
      const batch = writeBatch(db);
      const membersRef = collection(db, 'members');

      // Optimization: Fetch all members first for faster duplicate checking (if memory allows)
      // For large lists, doing individual queries inside the loop is very slow. 
      // But we will batch queries or just do individual since it's typically < 500 records.
      
      // Let's get existing member codes to avoid duplicate querying for every row
      const existingDocs = await getDocs(membersRef);
      const existingMembers = existingDocs.docs.map(d => d.data());
      
      setProgress(70);

      for (const rawRow of jsonData) {
        // Normalize keys
        const row = {};
        for (const key in rawRow) {
          if (rawRow.hasOwnProperty(key)) {
            row[key.trim()] = rawRow[key];
          }
        }

        if (!validateRow(row)) {
          failedCount++;
          continue;
        }

        const memberName = String(row['Name'] || row['Member Name'] || '').trim();
        const chapterStr = String(row['Chapter'] || row['Chapter Name'] || '').trim();
        const memberCodeStr = String(row['Column1'] || row['Member Code'] || '').trim() || generateMemberCode();
        
        if (!memberName || !chapterStr) {
          failedCount++;
          continue;
        }

        // Duplicate Check 1: Exact Member Code match
        const isCodeDuplicate = existingMembers.some(m => m.memberCode === memberCodeStr);
        if (isCodeDuplicate && row['Column1']) {
          duplicateCount++;
          continue;
        }

        // Duplicate Check 2: Same Name within the Same Chapter
        const isNameDuplicate = existingMembers.some(m => 
          m.memberName.toLowerCase() === memberName.toLowerCase() && 
          m.chapter.toLowerCase() === chapterStr.toLowerCase()
        );
        
        if (isNameDuplicate) {
          duplicateCount++;
          continue;
        }

        // Add to our local cache for the next iteration of the loop so we catch duplicates IN the excel itself
        existingMembers.push({
          memberCode: memberCodeStr,
          memberName: memberName,
          chapter: chapterStr
        });

        const newMemberRef = doc(membersRef);
        batch.set(newMemberRef, {
          memberCode: memberCodeStr,
          memberName: memberName,
          chapter: chapterStr,
          isCaptain: false, // Default
          status: 'Active', // Default
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        successCount++;
      }
      
      setProgress(90);

      if (successCount > 0) {
        await batch.commit();
      }
      
      setProgress(100);

      setResults({
        total: jsonData.length,
        success: successCount,
        duplicates: duplicateCount,
        failed: failedCount
      });

      if (successCount > 0) {
        onSuccess();
      }

    } catch (error) {
      console.error("Error importing Excel:", error);
      alert("Failed to process the file. Ensure it matches the expected format.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100"
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-xl font-semibold text-gray-900">Import Members</h2>
          <button onClick={onClose} disabled={loading} className="text-gray-400 hover:text-gray-500 transition-colors disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 bg-white relative">
          
          {/* Progress Overlay */}
          {loading && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-8">
               <div className="w-full max-w-xs">
                 <div className="flex justify-between text-sm font-medium text-gray-700 mb-2">
                   <span>Processing Excel...</span>
                   <span>{progress}%</span>
                 </div>
                 <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                   <div 
                     className="bg-bni-red h-2.5 rounded-full transition-all duration-300 ease-out" 
                     style={{ width: `${progress}%` }}
                   ></div>
                 </div>
                 <p className="text-xs text-gray-500 mt-4 text-center animate-pulse">
                   Please don't close this window
                 </p>
               </div>
            </div>
          )}

          {!results ? (
            <div className="space-y-6">
              <div 
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 group
                  ${isDragging ? 'border-bni-red bg-red-50/50' : 'border-gray-200 hover:border-red-200 hover:bg-red-50/30 cursor-pointer'}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !loading && fileInputRef.current?.click()}
              >
                <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-white transition-colors">
                  {file ? (
                    <FileSpreadsheet className="w-8 h-8 text-green-500" />
                  ) : (
                    <UploadCloud className={`w-8 h-8 ${isDragging ? 'text-bni-red' : 'text-gray-400 group-hover:text-bni-red'}`} />
                  )}
                </div>
                <p className="text-sm font-medium text-gray-900">
                  {file ? file.name : "Drag and drop your Excel file here"}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {file ? `${(file.size / 1024).toFixed(1)} KB` : "or click to browse (.xlsx, .xls)"}
                </p>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileChange} 
                  accept=".xlsx, .xls"
                  className="hidden"
                />
              </div>

              <div className="bg-blue-50/50 rounded-xl p-4 flex items-start border border-blue-100">
                <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5 mr-3 shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-1 text-blue-900">Expected Columns:</p>
                  <p className="text-blue-700 leading-relaxed font-mono bg-white px-2 py-1 rounded inline-block mt-1">Timestamp, Name, Chapter, Column1</p>
                  <ul className="text-xs mt-3 text-blue-700 space-y-1 list-disc pl-4">
                    <li><b>Timestamp</b> is ignored.</li>
                    <li><b>Column1</b> becomes the Member Code.</li>
                    <li>Duplicates in a Chapter are skipped.</li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <Button variant="outline" onClick={onClose} className="w-24">Cancel</Button>
                <Button onClick={handleImport} disabled={!file || loading} className="w-32">
                  Import Data
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 py-4">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Import Complete</h3>
                <p className="text-sm text-gray-500 mt-1">Your excel file has been processed.</p>
              </motion.div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-center">
                  <div className="text-3xl font-bold text-gray-900">{results.total}</div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mt-2">Total Rows</div>
                </div>
                <div className="bg-green-50 p-4 rounded-xl border border-green-100 text-center">
                  <div className="text-3xl font-bold text-green-700">{results.success}</div>
                  <div className="text-xs font-medium text-green-600 uppercase tracking-wider mt-2">Imported</div>
                </div>
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-center">
                  <div className="text-3xl font-bold text-amber-700">{results.duplicates}</div>
                  <div className="text-xs font-medium text-amber-600 uppercase tracking-wider mt-2">Duplicates</div>
                </div>
                <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-center">
                  <div className="text-3xl font-bold text-red-700">{results.failed}</div>
                  <div className="text-xs font-medium text-red-600 uppercase tracking-wider mt-2">Failed/Invalid</div>
                </div>
              </div>

              <div className="pt-2">
                <Button className="w-full" onClick={onClose} size="lg">
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
