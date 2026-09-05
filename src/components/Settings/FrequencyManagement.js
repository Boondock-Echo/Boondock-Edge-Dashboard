import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, Search, X, Filter, RotateCw, Check, AlertTriangle, 
    Save, RadioTower } from "lucide-react";
import { CTCSS_TONES, DCS_CODES } from "./tone-codes";

const FrequencyManagement = ({ edgeServerEndpoint, isDarkMode }) => {
    // Core state management
    const [frequencies, setFrequencies] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // UI state management
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState("create"); // create, edit, or delete
    const [selectedFrequency, setSelectedFrequency] = useState(null);
    const [showNotification, setShowNotification] = useState(false);
    const [notificationMessage, setNotificationMessage] = useState("");

    // Form state
    const [formData, setFormData] = useState({
        name: "",
        frequency: "",
        type: "NFM",
        tone: "",
        tag: "",
        person: "",
        status: "active"
    });

    // Preview model state
    const [previewModel, setPreviewModel] = useState({
        displayName: "",
        frequencyDisplay: "",
        typeDisplay: "",
        toneDisplay: "",
        tagDisplay: "",
        personDisplay: ""
    });

    // Update preview whenever form data changes
    useEffect(() => {
        setPreviewModel({
            displayName: formData.name || "Untitled Frequency",
            frequencyDisplay: formData.frequency ? `${formData.frequency} MHz` : "-- MHz",
            typeDisplay: formData.type || "NFM",
            toneDisplay: formData.tone || "None",
            tagDisplay: formData.tag || "None",
            personDisplay: formData.person || "Unassigned"
        });
    }, [formData]);

    // Fetch frequencies on component mount and when edgeServerEndpoint changes
    useEffect(() => {
        fetchFrequencies();
    }, [edgeServerEndpoint]);

    // API Functions
    const fetchFrequencies = async () => {
        try {
            setIsLoading(true);
            const response = await fetch(`${edgeServerEndpoint}/frequencies`);
            if (!response.ok) throw new Error("Failed to fetch frequencies");
            const data = await response.json();
            setFrequencies(data);
            setError(null);
        } catch (err) {
            setError(err.message);
            showTemporaryNotification("Failed to fetch frequencies");
        } finally {
            setIsLoading(false);
        }
    };

    const createFrequency = async (frequencyData) => {
        try {
            const response = await fetch(`${edgeServerEndpoint}/frequencies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(frequencyData),
            });
            if (!response.ok) throw new Error("Failed to create frequency");
            await fetchFrequencies();
            showTemporaryNotification("Frequency added successfully!");
            return true;
        } catch (err) {
            setError(err.message);
            showTemporaryNotification("Failed to create frequency");
            return false;
        }
    };

    const updateFrequency = async (id, frequencyData) => {
        try {
            const response = await fetch(`${edgeServerEndpoint}/frequencies/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(frequencyData),
            });
            if (!response.ok) throw new Error("Failed to update frequency");
            await fetchFrequencies();
            showTemporaryNotification("Frequency updated successfully!");
            return true;
        } catch (err) {
            setError(err.message);
            showTemporaryNotification("Failed to update frequency");
            return false;
        }
    };

    const deleteFrequency = async (id) => {
        try {
            const response = await fetch(`${edgeServerEndpoint}/frequencies/${id}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error("Failed to delete frequency");
            await fetchFrequencies();
            showTemporaryNotification("Frequency deleted successfully!");
            return true;
        } catch (err) {
            setError(err.message);
            showTemporaryNotification("Failed to delete frequency");
            return false;
        }
    };

    // UI Helper Functions
    const showTemporaryNotification = (message) => {
        setNotificationMessage(message);
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 3000);
    };

    const getStatusColor = (status) => {
        switch (status) {
            case "active": return "bg-green-500";
            case "critical": return "bg-red-500";
            default: return "bg-gray-500";
        }
    };

    // Form Handling Functions
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const resetForm = () => {
        setFormData({
            name: "",
            frequency: "",
            type: "NFM",
            tone: "",
            tag: "",
            person: "",
            status: "active"
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        let success = false;

        if (modalMode === "create") {
            success = await createFrequency(formData);
        } else if (modalMode === "edit" && selectedFrequency) {
            success = await updateFrequency(selectedFrequency.id, formData);
        }

        if (success) {
            setIsModalOpen(false);
            resetForm();
        }
    };

    const handleDelete = async () => {
        if (selectedFrequency) {
            const success = await deleteFrequency(selectedFrequency.id);
            if (success) {
                setIsModalOpen(false);
                setSelectedFrequency(null);
            }
        }
    };

    const openModal = (mode, frequency = null) => {
        setModalMode(mode);
        setSelectedFrequency(frequency);
        if (mode === "edit" && frequency) {
            setFormData(frequency);
        } else if (mode === "create") {
            resetForm();
        }
        setIsModalOpen(true);
    };

    const renderModal = () => (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Modal backdrop - removed blur effect */}
            <div className="fixed inset-0 bg-black/60" />
            
            {/* Modal container - improved positioning and scroll handling */}
            <div className="relative flex min-h-screen items-center justify-center p-4">
                <div className={`relative w-full max-w-md rounded-2xl ${
                    isDarkMode ? 'bg-gray-800' : 'bg-white'
                } p-6 shadow-xl`}>
                    {/* Modal header */}
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-semibold">
                            {modalMode === 'create' ? 'Add New Frequency' :
                             modalMode === 'edit' ? 'Edit Frequency' : 'Delete Frequency'}
                        </h3>
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className={`rounded-lg p-1 ${
                                isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                            } transition-colors`}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {modalMode !== 'delete' ? (
                        <>
                            {/* Preview Card - updated styling */}
                            <div className={`mb-6 p-4 rounded-lg ${
                                isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'
                            }`}>
                                <h4 className="text-sm font-medium mb-3">Preview</h4>
                                <div className="space-y-2">
                                    {/* [Preview content remains the same] */}
                                </div>
                            </div>

                            {/* Form - improved input styling */}
                            <form onSubmit={handleSubmit}>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Name</label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                                isDarkMode 
                                                    ? 'bg-gray-700 border-gray-600 focus:bg-gray-600' 
                                                    : 'bg-white border-gray-300'
                                            }`}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Frequency (MHz)</label>
                                        <input
                                            type="text"
                                            name="frequency"
                                            value={formData.frequency}
                                            onChange={handleInputChange}
                                            className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                                isDarkMode 
                                                    ? 'bg-gray-700 border-gray-600 focus:bg-gray-600' 
                                                    : 'bg-white border-gray-300'
                                            }`}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-2">Type</label>
                                            <select
                                                name="type"
                                                value={formData.type}
                                                onChange={handleInputChange}
                                                className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                                    isDarkMode 
                                                        ? 'bg-gray-700 border-gray-600 focus:bg-gray-600' 
                                                        : 'bg-white border-gray-300'
                                                }`}
                                            >
                                                <option value="NFM">NFM</option>
                                                <option value="FM">FM</option>
                                                <option value="AM">AM</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-2">Tone</label>
                                            <select
                                                name="tone"
                                                value={formData.tone}
                                                onChange={handleInputChange}
                                                className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                                    isDarkMode 
                                                        ? 'bg-gray-700 border-gray-600 focus:bg-gray-600' 
                                                        : 'bg-white border-gray-300'
                                                }`}
                                            >
                                                <option value="">None</option>
                                                <optgroup label="CTCSS Tones">
                                                    {CTCSS_TONES.map(tone => (
                                                        <option key={tone.freq} value={`CTCSS ${tone.freq}`}>
                                                            CTCSS {tone.freq} Hz ({tone.desc})
                                                        </option>
                                                    ))}
                                                </optgroup>
                                                <optgroup label="DCS Normal">
                                                    {DCS_CODES.normal.map(code => (
                                                        <option key={code} value={`DCS ${code}`}>
                                                            DCS {code}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Tag</label>
                                        <input
                                            type="text"
                                            name="tag"
                                            value={formData.tag}
                                            onChange={handleInputChange}
                                            className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                                isDarkMode 
                                                    ? 'bg-gray-700 border-gray-600 focus:bg-gray-600' 
                                                    : 'bg-white border-gray-300'
                                            }`}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Person</label>
                                        <input
                                            type="text"
                                            name="person"
                                            value={formData.person}
                                            onChange={handleInputChange}
                                            className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                                isDarkMode 
                                                    ? 'bg-gray-700 border-gray-600 focus:bg-gray-600' 
                                                    : 'bg-white border-gray-300'
                                            }`}
                                        />
                                    </div>
                                    <div className="pt-4 flex justify-end space-x-4">
                                        <button
                                            type="button"
                                            onClick={() => setIsModalOpen(false)}
                                            className={`px-4 py-2 rounded-lg border transition-colors ${
                                                isDarkMode 
                                                    ? 'border-gray-600 hover:bg-gray-700' 
                                                    : 'border-gray-300 hover:bg-gray-100'
                                            }`}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                                        >
                                            <Save className="w-4 h-4" />
                                            <span>{modalMode === 'create' ? 'Create' : 'Save Changes'}</span>
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </>
                    ) : (
                        <div>
                            <div className="flex items-center space-x-4 mb-6">
                                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                                    <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                                </div>
                                <div>
                                    <h4 className="text-lg font-medium mb-1">Confirm Deletion</h4>
                                    <p className="text-sm opacity-70">
                                        Are you sure you want to delete this frequency? This action cannot be undone.
                                    </p>
                                </div>
                            </div>
                            <div className="flex justify-end space-x-4">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className={`px-4 py-2 rounded-lg border ${
                                        isDarkMode ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-100'
                                    }`}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center space-x-2"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    <span>Delete</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div className={isDarkMode ? 'text-gray-100' : 'text-gray-900'}>
            {/* Header Section */}
            <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-blue-600' : 'bg-blue-500'}`}>
                        <RadioTower className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold">Stations</h3>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            Add and manage stations for your recordings
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => {
                        resetForm();
                        openModal('create', null);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    <span>Add Station</span>
                </button>
            </div>

            {/* Search and Filter Bar */}
            <div className={`mb-6 p-4 rounded-xl ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
                    <div className="flex items-center justify-between gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search frequencies..."
                                className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
                                    isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'
                                }`}
                            />
                        </div>
                        <button className={`p-2 rounded-lg border ${isDarkMode ? 'border-gray-700' : 'border-gray-300'}`}>
                            <Filter className="w-5 h-5" />
                        </button>
                        <button 
                            onClick={fetchFrequencies}
                            className={`p-2 rounded-lg border ${isDarkMode ? 'border-gray-700' : 'border-gray-300'}`}
                        >
                            <RotateCw className="w-5 h-5" />
                        </button>
                    </div>
                </div>

            {/* Frequencies Table */}
            <div className={`rounded-xl overflow-hidden shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                {isLoading ? (
                    <div className="p-8 text-center">Loading...</div>
                ) : error ? (
                    <div className="p-8 text-center text-red-500">{error}</div>
                ) : (
                    <table className="w-full">
                        <thead className={isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'}>
                            <tr>
                                <th className="px-6 py-4 text-left">Status</th>
                                <th className="px-6 py-4 text-left">Name/Frequency</th>
                                <th className="px-6 py-4 text-left">Type/Tone</th>
                                <th className="px-6 py-4 text-left">Tag</th>
                                <th className="px-6 py-4 text-left">Person</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                            {frequencies.map((freq) => (
                                <tr key={freq.id} className={`${isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}`}>
                                    <td className="px-6 py-4">
                                        <div className={`w-3 h-3 rounded-full ${getStatusColor(freq.status)}`} />
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-medium">{freq.name}</div>
                                        <div className="text-sm text-gray-500">{freq.frequency} MHz</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-medium">{freq.type}</div>
                                        <div className="text-sm text-gray-500">{freq.tone}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs ${
                                            freq.tag === 'Priority' 
                                                ? 'bg-red-100 text-red-800' 
                                                : 'bg-green-100 text-green-800'
                                        }`}>
                                            {freq.tag}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">{freq.person}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => openModal('edit', freq)}
                                            className="text-blue-600 hover:text-blue-900 mr-4"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => openModal('delete', freq)}
                                            className="text-red-600 hover:text-red-900"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {isModalOpen && renderModal()}

            {/* Notification Toast */}
            {showNotification && (
                <div className="fixed bottom-4 right-4 z-50">
                    <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-4 flex items-center space-x-3`}>
                        <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                            <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <p className="text-sm font-medium">{notificationMessage}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FrequencyManagement;